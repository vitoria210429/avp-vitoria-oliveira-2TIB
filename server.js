import "dotenv/config";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || process.env.TOKEN_SECRET;
const API_NAME = process.env.API_NAME || "API Catálogo de Filmes";
const MAX_UPLOAD_SIZE_MB = Number(process.env.MAX_UPLOAD_SIZE_MB) || 5;
const UPLOAD_FIELD_NAME = process.env.UPLOAD_FIELD_NAME || "imagem";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDirectory = path.join(__dirname, "uploads");

fs.mkdirSync(uploadsDirectory, { recursive: true });
app.use(express.json());

let filmes = [
  { id: 1, titulo: "Interestelar", genero: "Ficção Científica", ano: 2014, diretor: "Christopher Nolan", descricao: "Um grupo de astronautas parte em busca de um novo lar para a humanidade." },
  { id: 2, titulo: "O Poderoso Chefão", genero: "Drama", ano: 1972, diretor: "Francis Ford Coppola", descricao: "A história de uma família envolvida no comando de uma organização criminosa." },
  { id: 3, titulo: "Cidade de Deus", genero: "Crime", ano: 2002, diretor: "Fernando Meirelles", descricao: "Dois jovens seguem caminhos diferentes em uma comunidade do Rio de Janeiro." }
];
let nextFilmId = 4;

const requireApiKey = (req, res, next) => {
  const authorization = req.header("authorization");
  const bearerToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;
  const apiKey = req.header("x-api-key");

  if (!API_KEY || (bearerToken !== API_KEY && apiKey !== API_KEY)) {
    return res.status(401).json({
      erro: "Acesso não autorizado. Envie Authorization: Bearer TOKEN_SECRET ou x-api-key válido."
    });
  }

  next();
};

const upload = multer({
  dest: uploadsDirectory,
  limits: { fileSize: MAX_UPLOAD_SIZE_MB * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    if (file.mimetype.startsWith("image/")) {
      return callback(null, true);
    }

    callback(new multer.MulterError("LIMIT_UNEXPECTED_FILE", UPLOAD_FIELD_NAME));
  }
});

const getFilmId = (req) => Number(req.params.id);
const isValidId = (id) => Number.isInteger(id) && id > 0;
const filmFields = ["titulo", "genero", "ano", "diretor", "descricao"];

const validateFilm = (body, partial = false) => {
  const textFields = ["titulo", "genero", "diretor", "descricao"];
  const fieldsToValidate = partial
    ? textFields.filter((field) => body[field] !== undefined)
    : textFields;

  for (const field of fieldsToValidate) {
    if (typeof body[field] !== "string" || body[field].trim() === "") {
      return `O campo ${field} deve ser um texto não vazio.`;
    }
  }

  if (!partial || body.ano !== undefined) {
    if (!Number.isInteger(body.ano) || body.ano < 1888 || body.ano > new Date().getFullYear()) {
      return "O campo ano deve ser um número inteiro entre 1888 e o ano atual.";
    }
  }

  return null;
};

const normalizeFilm = (body) => Object.fromEntries(
  filmFields.map((field) => [field, field === "ano" ? body[field] : body[field].trim()])
);

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: API_NAME,
      version: "1.0.0",
      description: "API REST para cadastrar, consultar, editar e excluir filmes, com middleware de proteção, upload de imagens e documentação Swagger."
    },
    servers: [{ url: `http://localhost:${PORT}` }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description: "Informe o valor de TOKEN_SECRET. O header deve usar o formato Bearer TOKEN_SECRET."
        }
      },
      schemas: {
        Filme: {
          type: "object",
          required: ["titulo", "genero", "ano", "diretor", "descricao"],
          properties: {
            id: { type: "integer", example: 1 },
            titulo: { type: "string", example: "Interestelar" },
            genero: { type: "string", example: "Ficção Científica" },
            ano: { type: "integer", example: 2014 },
            diretor: { type: "string", example: "Christopher Nolan" },
            descricao: { type: "string", example: "Um grupo de astronautas parte em busca de um novo lar para a humanidade." }
          }
        }
      }
    }
  },
  apis: ["./server.js"]
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

app.get("/", (req, res) => {
  res.json({ mensagem: "API Catálogo de Filmes funcionando!" });
});

/**
 * @swagger
 * /filmes:
 *   post:
 *     summary: Cadastra um filme
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/Filme' }
 *     responses:
 *       201: { description: Filme cadastrado }
 *       401: { description: Chave ausente ou inválida }
 */
app.post("/filmes", requireApiKey, (req, res) => {
  const validationError = validateFilm(req.body);
  if (validationError) {
    return res.status(400).json({ mensagem: validationError });
  }

  const filme = { id: nextFilmId++, ...normalizeFilm(req.body) };
  filmes.push(filme);
  res.status(201).json({ mensagem: "Filme cadastrado com sucesso.", filme });
});

/**
 * @swagger
 * /filmes:
 *   get:
 *     summary: Lista todos os filmes
 *     responses:
 *       200: { description: Lista de filmes }
 */
app.get("/filmes", (req, res) => {
  res.json(filmes);
});

/**
 * @swagger
 * /filmes/{id}:
 *   get:
 *     summary: Busca um filme pelo ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Filme encontrado }
 *       404: { description: Filme não encontrado }
 */
app.get("/filmes/:id", (req, res) => {
  const id = getFilmId(req);
  const filme = filmes.find((item) => item.id === id);

  if (!isValidId(id) || !filme) {
    return res.status(404).json({ mensagem: "Filme não encontrado." });
  }

  res.json(filme);
});

/**
 * @swagger
 * /filmes/{id}:
 *   put:
 *     summary: Edita um filme pelo ID
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/Filme' }
 *     responses:
 *       200: { description: Filme atualizado }
 *       404: { description: Filme não encontrado }
 *   patch:
 *     summary: Atualiza parcialmente um filme pelo ID
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/Filme' }
 *     responses:
 *       200: { description: Filme atualizado }
 *       401: { description: Chave ausente ou inválida }
 */
const updateFilm = (req, res) => {
  const id = getFilmId(req);
  const filme = filmes.find((item) => item.id === id);

  if (!isValidId(id) || !filme) {
    return res.status(404).json({ mensagem: "Filme não encontrado." });
  }

  const invalidFields = Object.keys(req.body)
    .filter((field) => !filmFields.includes(field));
  if (invalidFields.length > 0) {
    return res.status(400).json({ mensagem: `Campos não permitidos: ${invalidFields.join(", ")}.` });
  }

  const updatedData = { ...filme, ...req.body };
  const validationError = validateFilm(updatedData, true);
  if (validationError) {
    return res.status(400).json({ mensagem: validationError });
  }

  Object.assign(filme, normalizeFilm(updatedData));
  res.json({ mensagem: "Filme atualizado com sucesso.", filme });
};

app.put("/filmes/:id", requireApiKey, updateFilm);
app.patch("/filmes/:id", requireApiKey, updateFilm);

/**
 * @swagger
 * /filmes/{id}:
 *   delete:
 *     summary: Exclui um filme pelo ID
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Filme excluído }
 *       404: { description: Filme não encontrado }
 */
app.delete("/filmes/:id", requireApiKey, (req, res) => {
  const id = getFilmId(req);
  const filmIndex = filmes.findIndex((item) => item.id === id);

  if (!isValidId(id) || filmIndex === -1) {
    return res.status(404).json({ mensagem: "Filme não encontrado." });
  }

  const [filme] = filmes.splice(filmIndex, 1);
  res.json({ mensagem: "Filme excluído com sucesso.", filme });
});

/**
 * @swagger
 * /upload:
 *   post:
 *     summary: Envia uma imagem de filme
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [imagem]
 *             properties:
 *               imagem: { type: string, format: binary }
 *     responses:
 *       201: { description: Imagem enviada }
 *       400: { description: Arquivo inválido ou ausente }
 */
app.post("/upload", requireApiKey, upload.single(UPLOAD_FIELD_NAME), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ mensagem: `Envie uma imagem no campo ${UPLOAD_FIELD_NAME}.` });
  }

  res.status(201).json({
    mensagem: "Imagem enviada com sucesso.",
    arquivo: { nome: req.file.filename, caminho: `/uploads/${req.file.filename}` }
  });
});

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use((req, res) => {
  res.status(404).json({ erro: "Rota não encontrada." });
});

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    const message = error.code === "LIMIT_FILE_SIZE"
      ? `A imagem deve ter no máximo ${MAX_UPLOAD_SIZE_MB} MB.`
      : `Envie somente arquivos de imagem no campo ${UPLOAD_FIELD_NAME}.`;
    return res.status(400).json({ mensagem: message });
  }

  next(error);
});

app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return res.status(400).json({ erro: "JSON inválido." });
  }

  console.error(error);
  res.status(500).json({ erro: "Erro interno do servidor." });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log(`Swagger disponível em http://localhost:${PORT}/api-docs`);
});

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

const filmes = [];
let nextFilmId = 1;

const requireApiKey = (req, res, next) => {
  if (!API_KEY || req.header("x-api-key") !== API_KEY) {
    return res.status(401).json({
      mensagem: "Acesso negado. Envie uma chave x-api-key válida."
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

    callback(new multer.MulterError("LIMIT_UNEXPECTED_FILE", "imagem"));
  }
});

const getFilmId = (req) => Number(req.params.id);
const isValidId = (id) => Number.isInteger(id) && id > 0;
const filmFields = ["titulo", "genero", "ano", "diretor", "descricao"];

const validateFilm = (body) => {
  const missingFields = ["titulo", "genero", "ano", "diretor", "descricao"]
    .filter((field) => body[field] === undefined || body[field] === "");

  if (missingFields.length > 0) {
    return `Campos obrigatórios: ${missingFields.join(", ")}.`;
  }

  if (!Number.isInteger(Number(body.ano)) || Number(body.ano) < 1888) {
    return "O campo ano deve ser um número inteiro válido.";
  }

  return null;
};

const pickFilmFields = (body) => Object.fromEntries(
  filmFields.map((field) => [field, field === "ano" ? Number(body[field]) : body[field]])
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
        apiKey: { type: "apiKey", in: "header", name: "x-api-key" }
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
 *     security: [{ apiKey: [] }]
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

  const filme = { id: nextFilmId++, ...pickFilmFields(req.body) };
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
 *     security: [{ apiKey: [] }]
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
 *     security: [{ apiKey: [] }]
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
  const filmIndex = filmes.findIndex((item) => item.id === id);

  if (!isValidId(id) || filmIndex === -1) {
    return res.status(404).json({ mensagem: "Filme não encontrado." });
  }

  const validationError = validateFilm(req.body);
  if (validationError) {
    return res.status(400).json({ mensagem: validationError });
  }

  filmes[filmIndex] = { id, ...pickFilmFields(req.body) };
  res.json({ mensagem: "Filme atualizado com sucesso.", filme: filmes[filmIndex] });
};

app.put("/filmes/:id", requireApiKey, updateFilm);
app.patch("/filmes/:id", requireApiKey, updateFilm);

/**
 * @swagger
 * /filmes/{id}:
 *   delete:
 *     summary: Exclui um filme pelo ID
 *     security: [{ apiKey: [] }]
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
 *     security: [{ apiKey: [] }]
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
    return res.status(400).json({ mensagem: "Envie uma imagem no campo imagem." });
  }

  res.status(201).json({
    mensagem: "Imagem enviada com sucesso.",
    arquivo: { nome: req.file.filename, caminho: `/uploads/${req.file.filename}` }
  });
});

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
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
  console.error(error);
  res.status(500).json({ mensagem: "Erro interno do servidor." });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log(`Swagger disponível em http://localhost:${PORT}/api-docs`);
});

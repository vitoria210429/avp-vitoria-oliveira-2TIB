# API Catálogo de Filmes

API REST em Node.js e Express para cadastrar e gerenciar filmes usando armazenamento em memória. O projeto inclui proteção por `x-api-key`, upload de imagens e documentação Swagger.

## Tecnologias

- Node.js
- Express
- dotenv
- Multer
- Swagger UI Express
- Swagger JSDoc

## Instalação e execução

```bash
npm install
npm start
```

A API estará em `http://localhost:3000`.
A documentação Swagger estará em `http://localhost:3000/api-docs`.

## Configuração

O projeto aceita `API_KEY` ou `TOKEN_SECRET` no arquivo `.env`. A configuração atual pode permanecer assim:

```env
DATABASE_URL=
TOKEN_SECRET="PIPOCADOCE123"
```

Use `.env.example` como modelo alternativo. As rotas protegidas exigem o header com o mesmo valor configurado:

```text
x-api-key: PIPOCADOCE123
```

Sem o header, ou usando uma chave incorreta, a API responde com `401`.

## Rotas

As consultas `GET /filmes` e `GET /filmes/:id` são públicas. Cadastro, edição, exclusão e upload são protegidos por `x-api-key`.

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/` | Verifica se a API está funcionando |
| POST | `/filmes` | Cadastra um filme |
| GET | `/filmes` | Lista os filmes, sem autenticação |
| GET | `/filmes/:id` | Busca um filme pelo ID, sem autenticação |
| PUT | `/filmes/:id` | Atualiza um filme |
| PATCH | `/filmes/:id` | Atualiza um filme |
| DELETE | `/filmes/:id` | Exclui um filme |
| POST | `/upload` | Envia uma imagem de filme |
| GET | `/api-docs` | Abre a documentação Swagger |

### Corpo para cadastrar ou editar

```json
{
  "titulo": "Interestelar",
  "genero": "Ficção Científica",
  "ano": 2014,
  "diretor": "Christopher Nolan",
  "descricao": "Um grupo de astronautas parte em busca de um novo lar para a humanidade."
}
```

Os dados ficam em memória e são perdidos quando o servidor é encerrado. Cada filme recebe um ID único durante a execução.

## Testes no Insomnia

1. Execute `GET http://localhost:3000/filmes` sem header: deve retornar `200`.
2. Execute `GET http://localhost:3000/filmes/:id` sem header: deve retornar `200` para um ID existente.
3. Envie o JSON acima em `POST /filmes` sem header: deve retornar `401`.
4. Repita o POST com `x-api-key: PIPOCADOCE123` e use o ID retornado para testar PATCH e DELETE.
5. Para upload, use `POST http://localhost:3000/upload`, o header correto e o corpo `Multipart Form` com o campo `imagem` configurado como arquivo.

O upload aceita somente imagens e arquivos de até 5 MB. Os arquivos são salvos em `uploads/`, que não deve ser enviado ao Git.

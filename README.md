# Controle de Dispositivos

Sistema web para controle de empréstimos, devoluções e cadastro de dispositivos de tecnologia da Escola Percio.

## Como executar

1. Abra o projeto na pasta raiz.
2. Instale dependências não são necessárias.
3. Rode:

```bash
npm start
```

4. Acesse `http://localhost:8000`.

## Configuração

- Edite `config.js` com a URL e a `anon key` do Supabase.
- O aplicativo carrega o arquivo `manifest.json` e registra o `service-worker.js` quando é servido por HTTP.

## Banco de dados

Execute os scripts nesta ordem:

1. `create_tables.sql`
2. `atualizar_tabela_devices.sql`
3. `finalizar_config.sql` se quiser popular os dados de exemplo

## Observações

- O `server.js` está preparado para rotas com query string, como as usadas no refresh do app.
- O `service worker` faz cache do shell da aplicação e tenta aproveitar bibliotecas externas em modo offline.

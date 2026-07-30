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
3. `controle_acesso_usuarios.sql`
4. `historico_alteracoes_dispositivos.sql`
5. `admin_avisos_afazeres.sql`
6. `admin_impressos_avisos.sql`
7. `devolucao_individual_dispositivos.sql`
8. `prazo_alertas_emprestimos.sql`
9. `protecao_emprestimos_simultaneos.sql`
10. `agendamentos_reservas_semanais.sql`
11. `finalizar_config.sql` se quiser popular os dados de exemplo
12. `seguranca_rls_supabase.sql`

## Observações

- O `server.js` está preparado para rotas com query string, como as usadas no refresh do app.
- O `service worker` faz cache do shell da aplicação e tenta aproveitar bibliotecas externas em modo offline.

## Organização do código

- `css/styles.css`: estilos visuais, responsividade e modo escuro.
- `js/core.js`: configuração, estado global, autenticação e inicialização.
- `js/database.js`: carregamento, sincronização e verificação do banco.
- `js/interface.js`: navegação, dashboard, agendamentos e interface de dispositivos.
- `js/loans.js`: criação, listagem e regras de empréstimos.
- `js/returns.js`: devoluções completas, parciais e por dispositivo.
- `js/reports.js`: relatórios, etiquetas e backups.
- `js/management.js`: cadastros e manutenção de turmas, professores e dispositivos.

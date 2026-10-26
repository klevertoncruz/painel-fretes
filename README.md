# Painel de fretes agregados

App web com login para o fechamento dos fretes de agregados e para os indicadores de justificativa de custos.
É publicado de graça no GitHub Pages e usa o Firebase para o login (e-mail e senha) e para guardar os dados.

## Como funciona

- Só entra quem tem usuário criado no Firebase.
- Quem está na lista de administradores vê o botão **Importar planilha**: ele lê a exportação "Fretes Terceiros" do sistema (.xlsx) e substitui a base.
- **Correções**: valores que estão errados no sistema (ex.: valor da carga sem a vírgula). Elas ficam guardadas e continuam valendo depois de cada nova importação.
- **Exportar Excel** baixa o fechamento, as rotas e as ocorrências do filtro atual.

## Configuração (uma vez)

1. **Firebase** (console.firebase.google.com), projeto `painel-fretes`:
   - Authentication > Método de login: ativar **E-mail/senha**.
   - Firestore Database: criar em `southamerica-east1`, modo de produção.
   - Configurações do projeto > Seus apps > **</>**: copiar o `firebaseConfig` para `firebase-config.js`.
2. **Regras do banco**: Firestore Database > Regras: colar o conteúdo de `firestore.rules` e publicar.
3. **Administradores**: Firestore Database > Dados > Iniciar coleção `config`, documento `admins`,
   campo `emails` do tipo **array** com os e-mails que podem importar planilha e corrigir dados.
4. **Usuários**: Authentication > Usuários > Adicionar usuário (e-mail e senha) para cada pessoa.
   Quem esquecer a senha usa "Esqueci a senha" na tela de login.
5. **GitHub Pages**: no repositório, Settings > Pages > Source: **GitHub Actions**.
   A cada mudança na branch `main` o app é publicado em `https://<usuario>.github.io/painel-fretes/`.

## Arquivos

- `index.html`: telas de login e do painel.
- `app.js`: login, leitura da base, importação da planilha, correções e exportação.
- `painel.js` / `painel.css`: o painel (indicadores, fechamento, rankings, rotas, ocorrências).
- `dash-shim.js`: liga o painel aos dados carregados pelo app.
- `firestore.rules`: quem pode ler e escrever.
- `correcoes-iniciais.json`: correções já combinadas, carregadas uma vez pelo botão em Correções.

## Justificativa de custos

A aba "Justificativa de custos" monta a prestação de contas do mês (orçado x realizado, volume x reajuste,
indicadores da operação, evolução mensal, transportadores, justificativa e ações). Os números do orçamento
ficam em `justificativas/{AAAA-MM}` no Firestore (só administradores gravam; atualize as regras com `firestore.rules`).
"Apresentar" abre os slides em tela cheia; "Baixar PowerPoint" gera o .pptx no navegador (PptxGenJS 3.12.0 em `vendor/`, licença MIT).

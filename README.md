# Enerlis – protótipo navegável

Protótipo do aplicativo de gestão inteligente de energia com IA (projeto acadêmico UNISUL – ADS).
É um site estático: um único arquivo `index.html`, sem instalação e sem servidor.

## Melhorias recentes

- Interface responsiva para celular e desktop, com foco de teclado mais visível.
- Escolhas do simulador persistidas no navegador com `localStorage`.
- Ação para restaurar as sugestões iniciais e mensagens de confirmação para as principais ações.
- Metadados de descrição para compartilhamento e melhor indexação.
- Navegação por hash preservada (`#inicio`, `#raiox`, `#simulador`, `#metas`).

## Testar no computador

Dê dois cliques em `index.html`. Ele abre no navegador.

## Publicar na Vercel

### Opção 1 – pelo GitHub (sem instalar nada)
1. Crie uma conta em https://github.com e um repositório novo (ex.: `enerlis-prototipo`).
2. Clique em **Add file › Upload files**, arraste `index.html`, `vercel.json` e `README.md` e clique em **Commit changes**.
3. Entre em https://vercel.com, faça login com o GitHub e clique em **Add New… › Project**.
4. Escolha o repositório `enerlis-prototipo` e clique em **Import**.
5. Em *Framework Preset*, deixe **Other**. Não precisa mudar mais nada. Clique em **Deploy**.
6. Em cerca de 1 minuto a Vercel mostra o link (ex.: `enerlis-prototipo.vercel.app`).

### Opção 2 – pela linha de comando
Precisa do Node.js instalado.

```bash
cd enerlis-prototipo
npx vercel        # na primeira vez pede login e algumas confirmações (pode aceitar o padrão)
npx vercel --prod # publica a versão final
```

## QR code para o banner

Depois de publicar, gere um QR code com o link da Vercel (qualquer gerador gratuito de QR code serve)
e coloque no lugar do quadro [QR CODE] do banner.

## Telas

- Boas-vindas: "Fotografar minha conta" (abre a câmera no celular) ou "Usar uma conta de exemplo"
- Leitura da conta: simulação da IA lendo a conta
- Início: previsão da conta, economia possível, o que mais pesa, alerta
- Raio-X: composição da conta e consumo estimado por uso
- Simulador: liga/desliga mudanças e recalcula a economia na hora
- Metas: meta do mês, economia confirmada, próxima melhoria com parceiro

Atalhos diretos: `#inicio`, `#raiox`, `#simulador`, `#metas` no fim do link.
Dados ilustrativos de uma padaria fictícia. Nenhum dado é enviado para lugar nenhum.

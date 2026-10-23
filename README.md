# 🍬 Candy Math

Jogo de matemática para o Ensino Fundamental (1º ao 9º ano) com estética de doces
estilo "Candy Crush". A criança joga por trilhas alinhadas à BNCC, e o responsável
acompanha o progresso na Área dos Pais.

## ✨ O que tem dentro

- **16 trilhas** organizadas nas 5 unidades temáticas da BNCC
  (Números, Álgebra, Geometria, Medidas, Grandezas e Probabilidade/Estatística),
  com 77 habilidades identificadas por código oficial (`EF01MA01` … `EF09MA35`).
- **9 modos de jogo**: Quiz Doce, Chuva de Doces, Corrida Doce, Verdadeiro ou Falso,
  Memória Doce, Cruzadinha Doce, Fatia de Bolo, Balança do Saco e Mercadinho da Juju.
- **Motor adaptativo**: as perguntas vêm do ano escolar configurado e o sorteio dá
  mais peso para as habilidades onde a criança mais erra.
- **Área dos Pais** protegida por PIN: domínio por unidade, habilidades para reforçar,
  habilidades consolidadas, tempo de resposta, histórico de sessões, plano de estudo,
  troca de ano escolar e exportação em CSV.
- **Acessibilidade**: alto contraste, fonte para dislexia, redução de movimento e
  leitura em voz alta das perguntas.
- Sem cara de gerado por IA: tudo desenhado em CSS puro, sem imagens externas e sem
  dependência de biblioteca de UI.

## 🚀 Rodando localmente

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # gera dist/ para publicação
```

O jogo funciona **offline e sem banco**: todo o progresso fica no aparelho
(IndexedDB no navegador, Capacitor Preferences no app).

## 📁 Organização

```
index.html          tela do jogo (hub + 9 modos + Área dos Pais)
login.html          criação/entrada de perfil (ano escolar e PIN dos pais)
style.css           toda a linguagem visual cartoon
src/data/           currículo BNCC, frases da Juju, lojas, cruzadinhas
src/engine/         geradores de perguntas por unidade temática
src/games/          um arquivo por modo de jogo
src/ui/             hub, modais, toasts, Área dos Pais, desenhos das perguntas
src/state/          estado global + registro de cada tentativa
src/storage/        save/load (web e nativo)
src/services/       camada de nuvem (Supabase) — desligada por padrão
supabase/schema.sql tabelas + políticas de segurança
```

## ☁️ Supabase (opcional, já preparado)

1. Crie um projeto no Supabase e rode `supabase/schema.sql` no SQL Editor.
2. Copie a **Project URL** e a chave **anon** para as variáveis de ambiente:

   ```bash
   cp .env.example .env
   # edite VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
   ```

3. Pronto: `saveState()` passa a enfileirar o progresso para as tabelas
   `profiles`, `sessions`, `skill_progress` e `attempts`. Sem as variáveis,
   nenhuma chamada de rede acontece.

A camada usa a API REST do Supabase (sem SDK no bundle) e grava o lote também no
aparelho quando a rede cai, reenviando quando volta. As políticas RLS da **fase 1**
limitam cada aparelho aos próprios dados pelo cabeçalho `X-Device-Token`; antes de
abrir para contas reais, migre para a **fase 2** (Supabase Auth), descrita no SQL —
é o caminho recomendado quando o projeto envolver dados de crianças.

## ▲ Publicar na Vercel

O repositório já traz `vercel.json` (framework Vite, build `npm run build`,
saída `dist/`, cache de assets e headers de segurança).

1. Importe o repositório na Vercel.
2. Em **Environment Variables**, adicione `VITE_SUPABASE_URL` e
   `VITE_SUPABASE_ANON_KEY` se for usar a nuvem.
3. Deploy. Os dois páginas (`/` e `/login.html`) são servidas como estático —
   não há função serverless obrigatória.

## 📱 App (Capacitor)

```bash
npm run build
npx cap sync
npm run cap:android   # ou cap:ios
```

## 🧒 Trilha pedagógica

A dificuldade sobe dentro da série do aluno (ex.: 3º ano começa com somas até 20 e
termina com até 1000). Ajustar o ano na Área dos Pais ou nas Configurações muda o
gerador na hora, sem apagar o progresso.

## 📄 Licença

Distribuído sob a licença MIT.

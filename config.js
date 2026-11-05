/* ===================================================
   CANDY MATH — config.js
   As três linhas que ligam o jogo ao mundo externo.

   Deixe como está e o jogo funciona 100% offline: nada é enviado, nada é
   pedido emprestado, e a parte de rede do duelo fica explicada em vez de
   quebrada. Preencha com a SUA chave do Supabase e a conexão acorda sozinha.

   Onde pegar os valores:
     1. crie um projeto em https://supabase.com
     2. SQL Editor  → cole o conteúdo de supabase/schema.sql → Run
     3. Project Settings → API Keys  →  Project URL  e  Publishable key
        (no painel antigo ela se chama "anon public key"; é a mesma função)
     4. cole os dois aqui embaixo (e só aqui — este arquivo não tem segredo
        de servidor; a anon key é pública por natureza e o RLS do banco é o
        que protege os dados)
     5. Auth → URL configuration → Site URL: o endereço onde o jogo estiver
        publicado (ex.: https://seu-projeto.vercel.app) para o link de
        confirmação de e-mail voltar para cá.

   Nada mais neste arquivo precisa de edição.
   =================================================== */
(function (root) {
  'use strict';

  root.CM_CONFIG = {
    // Project URL do Supabase. Termina em .supabase.co — não precisa de nada
    // além do endereço; a chave pública faz o resto.
    supabaseUrl: 'https://jomezruaohlgvqizcsdf.supabase.co',

    // anon public key (no painel novo do Supabase ela se chama "Publishable
    // key"; o papel dela é `anon`). É a chave que um navegador pode usar: as
    // políticas de segurança (RLS) do schema é que decidem o que ela consegue
    // ler/gravar.
    supabaseAnonKey: 'sb_publishable_wKBbhztik_bqexYWPsCf_A_6rxE_WpI',

    // A biblioteca supabase-js vem de CDN. Se você publicar o jogo e quiser
    // servir tudo do mesmo lugar, troque pela cópia local (ex.: 'supabase.js')
    // e aponte para o arquivo UMD. Só endereços cdn.jsdelivr.net ou do próprio
    // projeto são aceitos (nuvem.js confere).
    supabaseJs: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js',

    // Intervalo da varredura de mensagens da sala quando o Realtime não está
    // disponível (rede corporativa, bloqueio de websocket). Em milissegundos.
    varreduraSalaMs: 900,

    // A prova e o boletim sobem para o banco a cada gravação local, com um
    // pequeno atraso para não escrever a cada clique. Em milissegundos.
    atrasoSubidaMs: 2500,

    // ── DUELO EM REDE: desligado por padrão ────────────────────────────
    // A versão 3.0 tinha políticas que deixavam qualquer pessoa ler e escrever
    // nas salas a partir do código. O schema deste repositório corrige isso
    // (autorização por conta, assento calculado no banco, lances conferidos),
    // mas a correção só vale depois de aplicada no SEU projeto e conferida:
    //   1. aplicar supabase/migrations/00001_*.sql e supabase/schema.sql
    //   2. rodar node testes/testar-rls.sql no SQL Editor (ou no seu Postgres)
    //   3. rodar node testes/testar-autorizacao.js com duas contas de teste
    // Enquanto os itens 2 e 3 não passarem, deixe false. Nada mais muda no
    // jogo: o duelo continua inteiro com os dois jogadores no mesmo aparelho.
    dueloRedeHabilitado: false,

    // ── NARRAÇÃO (Fish Audio AI) ───────────────────────────────────────
    // A chave nunca entra aqui: ela vive na Vercel, como variável secreta
    // FISH_AUDIO_API_KEY, e só a função api/voz.js a vê. O navegador fala com
    // /api/voz. Sem a variável, o jogo usa a voz do próprio aparelho e a tela
    // de voz explica o que falta.
    narracao: {
      // Caminho da função serverless. Em um projeto sem Vercel, deixe vazio
      // para usar só a síntese nativa do navegador.
      endpoint: '/api/voz',
      // 'peixe' = tentar a API e cair para a voz do aparelho; 'aparelho' =
      // nunca sair deste navegador; 'desligada' = nenhuma narração.
      preferencia: 'peixe',
      // As vozes que a tela oferece. O id é o que sobe para /api/voz e tem de
      // bater com a lista fechada de api/_voz-nucleo.js (testes/testar-narracao.js
      // confere isso): o reference_id da Fish Audio mora só no servidor, para
      // o navegador não poder pedir uma voz que o projeto não aprovou — nem
      // uma que exista fora da lista.
      //
      // Os quatro ids atuais são as vozes do projeto, indicadas pelo dono em
      // 04/11/2026 e conferidas uma a uma contra a API real (200 + mp3 em
      // todas, com a chave da conta dele). Não é lista do catálogo público
      // desta vez: se alguma voz for movida ou ficar privada na conta de
      // origem, a chamada passa a falhar e o jogo cai para a voz do aparelho
      // sozinha. Para trocar, mexa o id nas duas listas (aqui e no núcleo da
      // função) — o rótulo na tela continua o mesmo.
      vozes: [
        { id: 'sara', rotulo: 'Sara' },
        { id: 'bruna', rotulo: 'Bruna' },
        { id: 'miguel', rotulo: 'Miguel' },
        { id: 'evelyn', rotulo: 'Evelyn' },
      ],
      // Teto de caracteres por frase. Uma pergunta do jogo nunca chega perto
      // disso; o limite existe para conter uso abusivo do endpoint público.
      // O servidor tem o teto dele (FISH_AUDIO_MAX) e corta por conta própria.
      // O modelo (s2.1-pro-free, a rota de custo zero documentada) é escolha
      // do servidor: veja FISH_AUDIO_MODELO em CONFIGURACAO-DEPLOY.md.
      maximoCaracteres: 320,
    },
  };
})(typeof window !== 'undefined' ? window : this);

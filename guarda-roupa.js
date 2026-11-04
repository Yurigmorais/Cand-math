/* =========================================================
   CANDY MATH — guarda-roupa.js
   Catálogo de peças do mascote Juba Candy.

   Este arquivo é a única fonte dos itens da loja. O `script.js`
   só lê window.CM_GUARDAROPA, então dá para trocar preço, nome ou
   novidade aqui sem mexer na interface.

   Campos de cada peça
   -------------------
   id      : chave salva em `owned` e `equip`. Nunca troque o id de
             uma peça que já foi comprada — o save perde o item.
   cat     : categoria da aba (hat | glasses | outfit | shoes | wig | accessory)
   slot    : onde a peça veste o mascote. Diferente de cat só nos
             conjuntos, que ocupam a roupa mas se exibem na aba própria.
   name    : nome na loja
   icon    : classe do Font Awesome 6 free. Toda classe abaixo foi
             conferida na folha carregada (fa-donut, fa-lollipop e
             fa-candy não existem no conjunto free, por isso não aparecem).
   iconColor: cor do ícone
   price   : estrelas
   rarity  : comum | incomum | raro | epico | lendario
   tipo    : 'avulsa' | 'conjunto'. Conjunto é a fantasia completa,
             por isso custa mais.
   brinde  : ids que vêm junto com o conjunto, já possuídos
   desc    : linha de apoio na ficha do item

   Autoral: as fantasias de herói e de baile são inspiradas em tipos
   consagrados, com nomes que não pertencem a nenhuma marca.
   ========================================================= */
(function (root) {
'use strict';

// ── Chapéus e toucas ─────────────────────────────────────
const CHAPEUS = [
  { id: 'hat_crown',   cat: 'hat', name: 'Coroa de Açúcar',   icon: 'fa-crown',        iconColor: '#FFD93D', price: 50,  rarity: 'raro',    desc: 'A coroa oficial da confeitaria.' },
  { id: 'hat_party',   cat: 'hat', name: 'Chapéu de Festa',   icon: 'fa-hat-wizard',   iconColor: '#FF6B9D', price: 30,  rarity: 'comum',   desc: 'Para todo dia de festa.' },
  { id: 'hat_chef',    cat: 'hat', name: 'Chapéu de Chef',    icon: 'fa-cake-candles', iconColor: '#FFFFFF', price: 40,  rarity: 'comum',   desc: 'Quem cozinha também conta.' },
  { id: 'hat_cowboy',  cat: 'hat', name: 'Chapéu de Cowboy',  icon: 'fa-hat-cowboy',   iconColor: '#FF9A3C', price: 45,  rarity: 'incomum', desc: 'Sombra boa para o sertão.' },
  { id: 'hat_hero',    cat: 'hat', name: 'Capacete de Herói', icon: 'fa-helmet-safety',iconColor: '#9B5DE5', price: 55,  rarity: 'incomum', desc: 'Protege a cabeça nas missões.' },
  { id: 'hat_santa',   cat: 'hat', name: 'Gorro de Natal',    icon: 'fa-snowflake',    iconColor: '#3DBBFF', price: 60,  rarity: 'raro',    desc: 'Gelo, neve e chocolate quente.' },
  { id: 'hat_rosto',   cat: 'hat', name: 'Máscara de Baile',  icon: 'fa-masks-theater',  iconColor: '#FF4757', price: 70,  rarity: 'raro',    desc: 'Entrada livre no salão doce.' },
  { id: 'hat_mascara', cat: 'hat', name: 'Máscara de Herói',  icon: 'fa-mask',           iconColor: '#3DBBFF', price: 65,  rarity: 'incomum', desc: 'Só os olhos de fora, como todo herói.' },
  { id: 'hat_cap',     cat: 'hat', name: 'Boné de Pirulito',  icon: 'fa-candy-cane',     iconColor: '#FF4757', price: 25,  rarity: 'comum',   desc: 'O boné mais barato da loja.' },
];

// ── Óculos (todos de doce) ───────────────────────────────
// A pedida foi mover os óculos para o lado da confeitaria: cada par
// agora é uma guloseima diferente, inclusive os quatro que já existiam.
const OCULOS = [
  { id: 'glass_star',   cat: 'glasses', name: 'Óculos Estrela de Açúcar', icon: 'fa-star',          iconColor: '#FFD93D', price: 25, rarity: 'comum',   desc: 'Estrelinhas de açúcar cristalizado.' },
  { id: 'glass_heart',  cat: 'glasses', name: 'Óculos Coração de Goma',   icon: 'fa-heart',         iconColor: '#FF6B9D', price: 30, rarity: 'comum',   desc: 'Bala de goma em dois corações.' },
  { id: 'glass_sun',    cat: 'glasses', name: 'Óculos Casquinha de Sorvete', icon: 'fa-ice-cream',  iconColor: '#4ECDC4', price: 35, rarity: 'incomum', desc: 'Antes era óculos de sol; virou sorvete de duas bolas.' },
  { id: 'glass_rain',   cat: 'glasses', name: 'Óculos Arco-íris de Calda',icon: 'fa-rainbow',       iconColor: '#9B5DE5', price: 45, rarity: 'incomum', desc: 'Sete cores de xarope de fruta.' },
  { id: 'glass_donut',  cat: 'glasses', name: 'Óculos Rosquinha',         icon: 'fa-ring',          iconColor: '#FF9A3C', price: 55, rarity: 'raro',    desc: 'Duas rosquinhas cobertas de glacê.' },
  { id: 'glass_choco',  cat: 'glasses', name: 'Óculos Calda de Chocolate',icon: 'fa-droplet',       iconColor: '#7B4B2A', price: 60, rarity: 'raro',    desc: 'A calda escorre e pinga na bochecha.' },
  { id: 'glass_floss',  cat: 'glasses', name: 'Óculos Algodão-Doce',      icon: 'fa-cloud',         iconColor: '#FF6B9D', price: 50, rarity: 'incomum', desc: 'Nuvem rosa de açúcar puxado.' },
  { id: 'glass_lolly',  cat: 'glasses', name: 'Óculos Pirulito de Menta', icon: 'fa-compact-disc',  iconColor: '#6BCB77', price: 48, rarity: 'incomum', desc: 'Espiral de bala dura, sabor menta.' },
];

// ── Roupas avulsas: camisetas e calças com conta ─────────
const ROUPAS = [
  { id: 'out_apron',   cat: 'outfit', name: 'Avental de Confeitaria', icon: 'fa-ice-cream',        iconColor: '#FF6B9D', price: 80,  rarity: 'incomum', desc: 'Bolso para guardar balas e sobras de massa.' },
  { id: 'out_cape',    cat: 'outfit', name: 'Capa de Super-Herói',  icon: 'fa-shield',           iconColor: '#9B5DE5', price: 100, rarity: 'raro',    desc: 'Voa junto com o vento da corrida.' },
  { id: 'out_tuxedo',  cat: 'outfit', name: 'Smoking Elegante',       icon: 'fa-shirt',            iconColor: '#3A2A4D', price: 90,  rarity: 'raro',    desc: 'Para o baile de gala da confeitaria.' },
  { id: 'out_wizard',  cat: 'outfit', name: 'Roupa de Mago',          icon: 'fa-wand-sparkles',    iconColor: '#9B5DE5', price: 110, rarity: 'epico',   desc: 'Estrelas costuradas no manto.' },
  { id: 'shirt_mais',  cat: 'outfit', name: 'Camiseta Mais e Menos',  icon: 'fa-plus-minus',       iconColor: '#FF4757', price: 35,  rarity: 'comum',   desc: 'Sinais coloridos na frente e nas mangas.' },
  { id: 'shirt_mult',  cat: 'outfit', name: 'Camiseta Vez e Divide',  icon: 'fa-calculator',       iconColor: '#3DBBFF', price: 40,  rarity: 'comum',   desc: 'Tabuada bordada em conta de doce.' },
  { id: 'shirt_igual', cat: 'outfit', name: 'Camiseta Sinal de Igual',icon: 'fa-equals',           iconColor: '#6BCB77', price: 45,  rarity: 'incomum', desc: 'Os dois lados sempre pesam igual.' },
  { id: 'shirt_pct',   cat: 'outfit', name: 'Blusa Porcentagem',      icon: 'fa-percent',          iconColor: '#FF9A3C', price: 55,  rarity: 'incomum', desc: 'Cem contas de açúcar distribuídas na manga.' },
  { id: 'pants_confe', cat: 'outfit', name: 'Calça de Confeitos',     icon: 'fa-shield',           iconColor: '#FF6B9D', price: 50,  rarity: 'incomum', desc: 'Bolinhas de todos os sabores nos bolsos.' },
  { id: 'pants_tabua', cat: 'outfit', name: 'Calça da Tabuada',       icon: 'fa-scroll',           iconColor: '#9B5DE5', price: 60,  rarity: 'raro',    desc: 'As nove linhas da tabuada, uma por perna.' },
  { id: 'vest_doce',   cat: 'outfit', name: 'Colete de Algodão-Doce', icon: 'fa-vest',             iconColor: '#FF4757', price: 65,  rarity: 'raro',    desc: 'Enchido de algodão-doce, leve de verdade.' },
  { id: 'dress_mor',   cat: 'outfit', name: 'Vestido Morango',        icon: 'fa-person-dress',     iconColor: '#FF4757', price: 45,  rarity: 'comum',   desc: 'Rodado, com cheiro de geleia.' },
  { id: 'dress_uva',   cat: 'outfit', name: 'Vestido Uva',            icon: 'fa-person-dress',     iconColor: '#9B5DE5', price: 45,  rarity: 'comum',   desc: 'Roxo de bala de goma.' },
  { id: 'dress_lima',  cat: 'outfit', name: 'Vestido Lima-Limão',     icon: 'fa-person-dress',     iconColor: '#6BCB77', price: 45,  rarity: 'comum',   desc: 'Azedinho e refrescante.' },
  { id: 'dress_azul',  cat: 'outfit', name: 'Vestido Mirtilo',        icon: 'fa-person-dress',     iconColor: '#3DBBFF', price: 50,  rarity: 'incomum', desc: 'Azul de fruta silvestre.' },
  { id: 'dress_mel',   cat: 'outfit', name: 'Vestido Melancia',       icon: 'fa-person-dress',     iconColor: '#FF6B9D', price: 50,  rarity: 'incomum', desc: 'Listrado de verde e vermelho, fatia de melancia.' },
];

// ── Calçados ─────────────────────────────────────────────
// Quatro saltos, três tênis sociais, cinco crocs, botinas e botas.
const CALCADOS = [
  { id: 'shoe_heel_morango', cat: 'shoes', name: 'Salto Morango',        icon: 'fa-shoe-prints', iconColor: '#FF4757', price: 55, rarity: 'incomum', desc: 'Salto alto de bala dura vermelha.' },
  { id: 'shoe_heel_uva',     cat: 'shoes', name: 'Salto Uva',            icon: 'fa-shoe-prints', iconColor: '#9B5DE5', price: 55, rarity: 'incomum', desc: 'Salto médio, cor de suco de uva.' },
  { id: 'shoe_heel_menta',   cat: 'shoes', name: 'Salto Menta',          icon: 'fa-shoe-prints', iconColor: '#4ECDC4', price: 60, rarity: 'raro',    desc: 'Salto fino com cheiro de menta.' },
  { id: 'shoe_heel_caramelo',cat: 'shoes', name: 'Salto Caramelo',       icon: 'fa-shoe-prints', iconColor: '#FF9A3C', price: 65, rarity: 'raro',    desc: 'O mais alto de todos, pingando caramelo.' },
  { id: 'shoe_social_branco',cat: 'shoes', name: 'Tênis Social Leite',   icon: 'fa-shoe-prints', iconColor: '#FFFFFF', price: 40, rarity: 'comum',   desc: 'Branquinho de sola emborrachada.' },
  { id: 'shoe_social_biscoito', cat: 'shoes', name: 'Tênis Social Biscoito', icon: 'fa-shoe-prints', iconColor: '#D9A05B', price: 45, rarity: 'comum', desc: 'Bege de biscoito amanteigado.' },
  { id: 'shoe_social_cacau', cat: 'shoes', name: 'Tênis Social Cacau',   icon: 'fa-shoe-prints', iconColor: '#3A2A4D', price: 45, rarity: 'comum',   desc: 'Escuro de chocolate, serve para festa.' },
  { id: 'shoe_croc_branca',  cat: 'shoes', name: 'Crocs Branca',         icon: 'fa-shoe-prints', iconColor: '#FFF7FB', price: 30, rarity: 'comum',   desc: 'Croc de leite, com furinhos para contas.' },
  { id: 'shoe_croc_lilas',   cat: 'shoes', name: 'Crocs Lilás',          icon: 'fa-shoe-prints', iconColor: '#C79BE8', price: 30, rarity: 'comum',   desc: 'Lilás bem clarinho.' },
  { id: 'shoe_croc_azul',    cat: 'shoes', name: 'Crocs Azul-Bebê',      icon: 'fa-shoe-prints', iconColor: '#9FD9FF', price: 30, rarity: 'comum',   desc: 'Azul de piscina aquecida.' },
  { id: 'shoe_croc_preta',   cat: 'shoes', name: 'Crocs Preta',          icon: 'fa-shoe-prints', iconColor: '#241A2F', price: 30, rarity: 'comum',   desc: 'Preta de alcaçuz.' },
  { id: 'shoe_croc_rosa',    cat: 'shoes', name: 'Crocs Rosa',           icon: 'fa-shoe-prints', iconColor: '#FF6B9D', price: 30, rarity: 'comum',   desc: 'Rosa de chiclete.' },
  { id: 'shoe_botina_baunilha', cat: 'shoes', name: 'Botina Baunilha',   icon: 'fa-socks',       iconColor: '#F3D9B5', price: 50, rarity: 'incomum', desc: 'Cano curto, cor de creme.' },
  { id: 'shoe_botina_caramelo', cat: 'shoes', name: 'Botina Caramelo',   icon: 'fa-socks',       iconColor: '#B5732F', price: 50, rarity: 'incomum', desc: 'Cano curto, resistente à trilha.' },
  { id: 'shoe_bota_goma',    cat: 'shoes', name: 'Bota de Chuva de Goma',icon: 'fa-socks',       iconColor: '#FF4757', price: 60, rarity: 'raro',    desc: 'Cano alto, não deixa a meia molhar.' },
  { id: 'shoe_bota_princesa',cat: 'shoes', name: 'Bota Brilhante de Baile', icon: 'fa-gem',      iconColor: '#3DBBFF', price: 75, rarity: 'epico',   desc: 'Cano alto coberto de glitter.' },
];

// ── Perucas ──────────────────────────────────────────────
// Seis penteados, como pedido: franja, cabelo curto completo, longa e
// mais três variações.
const PERUCAS = [
  { id: 'wig_franja',   cat: 'wig', name: 'Peruca de Franja',        icon: 'fa-brush',       iconColor: '#7B4B2A', price: 40, rarity: 'comum',   desc: 'Franja reta que cobre a testa.' },
  { id: 'wig_curta',    cat: 'wig', name: 'Peruca Cacheada Curta',   icon: 'fa-hurricane',   iconColor: '#3A2A4D', price: 45, rarity: 'comum',   desc: 'Cabelo curto e cheio de cacheio.' },
  { id: 'wig_longa',    cat: 'wig', name: 'Peruca Longa Ondulada',   icon: 'fa-wind',        iconColor: '#FF9A3C', price: 60, rarity: 'incomum', desc: 'Ondas grandes até a cintura.' },
  { id: 'wig_coque',    cat: 'wig', name: 'Peruca Coque de Bailarina', icon: 'fa-compact-disc', iconColor: '#9B5DE5', price: 65, rarity: 'raro',  desc: 'Coque alto e firme.' },
  { id: 'wig_trancas',  cat: 'wig', name: 'Peruca de Duas Tranças',  icon: 'fa-feather-pointed', iconColor: '#D9A05B', price: 55, rarity: 'incomum', desc: 'Duas tranças com fita de doce.' },
  { id: 'wig_cavalinho',cat: 'wig', name: 'Rabo de Cavalo Espiral',  icon: 'fa-candy-cane',  iconColor: '#FF6B9D', price: 70, rarity: 'raro',    desc: 'Preso no topo, pontas em espiral.' },
];

// ── Extras ───────────────────────────────────────────────
const EXTRAS = [
  { id: 'acc_cookie', cat: 'accessory', name: 'Biscoito Doce',    icon: 'fa-cookie',             iconColor: '#FF6B9D', price: 15, rarity: 'comum',   desc: 'Para segurar enquanto espera a vez.' },
  { id: 'acc_candy',  cat: 'accessory', name: 'Bala Especial',    icon: 'fa-candy-cane',         iconColor: '#FF4757', price: 15, rarity: 'comum',   desc: 'Embalagem que brilha.' },
  { id: 'acc_bow',    cat: 'accessory', name: 'Laço de Fita',     icon: 'fa-ribbon',             iconColor: '#FF6B9D', price: 20, rarity: 'comum',   desc: 'Fita de presente bem grande.' },
  { id: 'acc_flower', cat: 'accessory', name: 'Trevo da Sorte',   icon: 'fa-clover',             iconColor: '#6BCB77', price: 20, rarity: 'comum',   desc: 'Quatro folhas, quatro acertos.' },
  { id: 'acc_star',   cat: 'accessory', name: 'Varinha Mágica',   icon: 'fa-wand-magic-sparkles',iconColor: '#FFD93D', price: 35, rarity: 'incomum', desc: 'Transforma erro em pista.' },
  { id: 'acc_fire',   cat: 'accessory', name: 'Chama de Campeão', icon: 'fa-fire',               iconColor: '#FF9A3C', price: 50, rarity: 'raro',    desc: 'Acesa a cada sequência longa.' },
  { id: 'acc_asa',    cat: 'accessory', name: 'Asa de Fada',      icon: 'fa-feather',            iconColor: '#3DBBFF', price: 45, rarity: 'incomum', desc: 'Leve, e faz poeira de açúcar.' },
  { id: 'acc_rel',    cat: 'accessory', name: 'Relógio de Bolso', icon: 'fa-clock',              iconColor: '#9B5DE5', price: 55, rarity: 'raro',    desc: 'Marca o tempo do duelo.' },
];

// ── Conjuntos completos ──────────────────────────────────
// Fantasias inteiras. Cada uma veste a roupa e traz as peças combinando
// de brinde, já possuídas. Custam mais porque vêm completas.
const CONJUNTOS = [
  // Heróis
  { id: 'look_aracnideo', cat: 'outfit', tipo: 'conjunto', name: 'Conjunto Herói Aracnídeo', icon: 'fa-spider',      iconColor: '#FF4757', price: 150, rarity: 'epico',
    desc: 'Roupa de teias, máscara e tênis do mesmo padrão.', brinde: ['hat_mascara', 'shoe_croc_preta'] },
  { id: 'look_armadura',  cat: 'outfit', tipo: 'conjunto', name: 'Conjunto Armadura Escarlate', icon: 'fa-robot',    iconColor: '#FF9A3C', price: 180, rarity: 'epico',
    desc: 'Peças de metal vermelho e dourado, com reator no peito.', brinde: ['hat_hero', 'acc_fire'] },
  { id: 'look_colosso',   cat: 'outfit', tipo: 'conjunto', name: 'Conjunto Colosso Esmeralda', icon: 'fa-dragon',     iconColor: '#6BCB77', price: 170, rarity: 'epico',
    desc: 'Força total em verde, calça rasgada e mão gigante.', brinde: ['pants_confe', 'acc_fire'] },
  { id: 'look_motoqueiro',cat: 'outfit', tipo: 'conjunto', name: 'Conjunto Cavaleiro Motociclista', icon: 'fa-motorcycle', iconColor: '#3A2A4D', price: 160, rarity: 'raro',
    desc: 'Jaqueta de couro, capacete e bota de cano alto.', brinde: ['hat_hero', 'shoe_bota_goma'] },
  { id: 'look_xerife',    cat: 'outfit', tipo: 'conjunto', name: 'Conjunto Xerife do Sertão', icon: 'fa-horse',       iconColor: '#D9A05B', price: 140, rarity: 'raro',
    desc: 'Chapéu, colete e botina de couro legítimo de doce.', brinde: ['hat_cowboy', 'shoe_botina_caramelo'] },
  { id: 'look_ninja',     cat: 'outfit', tipo: 'conjunto', name: 'Conjunto Ninja de Alcaçuz', icon: 'fa-user-ninja',  iconColor: '#241A2F', price: 150, rarity: 'epico',
    desc: 'Preto por inteiro, com estrela de ninja na cintura.', brinde: ['hat_mascara', 'shoe_croc_preta'] },

  // Baile, neve e conto de fadas
  { id: 'look_neve',      cat: 'outfit', tipo: 'conjunto', name: 'Conjunto Rainha da Neve', icon: 'fa-snowflake',     iconColor: '#9FD9FF', price: 190, rarity: 'epico',
    desc: 'Vestido de gelo, coroa de cristal e bota brilhante.', brinde: ['hat_santa', 'shoe_bota_princesa'] },
  { id: 'look_baile',     cat: 'outfit', tipo: 'conjunto', name: 'Conjunto Princesa do Baile', icon: 'fa-person-dress',iconColor: '#3DBBFF', price: 185, rarity: 'epico',
    desc: 'Rodado azul de festa, saltinho e tiara de açúcar.', brinde: ['shoe_heel_uva', 'hat_crown'] },
  { id: 'look_rosa',      cat: 'outfit', tipo: 'conjunto', name: 'Conjunto Bela da Rosa', icon: 'fa-seedling',        iconColor: '#FF4757', price: 175, rarity: 'raro',
    desc: 'Amarelo de sol com uma rosa vermelha no bolso.', brinde: ['wig_longa', 'shoe_heel_caramelo'] },
  { id: 'look_gata',      cat: 'outfit', tipo: 'conjunto', name: 'Conjunto Gata do Vestido Azul', icon: 'fa-cat',      iconColor: '#4ECDC4', price: 160, rarity: 'raro',
    desc: 'Azul com laço de fita e sapato de boneca.', brinde: ['acc_bow', 'shoe_croc_azul'] },
  { id: 'look_boneca',    cat: 'outfit', tipo: 'conjunto', name: 'Conjunto Boneca Rodada', icon: 'fa-gift',           iconColor: '#FF6B9D', price: 200, rarity: 'lendario',
    desc: 'Vestido rodado cor-de-rosa, salto, peruca e brilhinhos.', brinde: ['shoe_heel_morango', 'wig_cavalinho'] },
  { id: 'look_fada',      cat: 'outfit', tipo: 'conjunto', name: 'Conjunto Fada do Açúcar', icon: 'fa-wand-sparkles', iconColor: '#C79BE8', price: 155, rarity: 'raro',
    desc: 'Asa, varinha e vestido curtinho de poeira.', brinde: ['acc_asa', 'acc_star'] },

  // Fantasias de doce
  { id: 'look_cupcake',   cat: 'outfit', tipo: 'conjunto', name: 'Fantasia de Cupcake', icon: 'fa-birthday-cake',    iconColor: '#FF6B9D', price: 130, rarity: 'raro',
    desc: 'Base de massa, cobertura rosa e cereja no topo.', brinde: ['hat_chef', 'shoe_croc_rosa'] },
  { id: 'look_sorvete',   cat: 'outfit', tipo: 'conjunto', name: 'Fantasia de Sorvete', icon: 'fa-ice-cream',        iconColor: '#9FD9FF', price: 125, rarity: 'raro',
    desc: 'Casquinha listrada com três bolas de sabores.', brinde: ['glass_sun', 'shoe_croc_branca'] },
  { id: 'look_chocolate', cat: 'outfit', tipo: 'conjunto', name: 'Fantasia de Chocolate', icon: 'fa-mug-hot',        iconColor: '#7B4B2A', price: 140, rarity: 'raro',
    desc: 'Chocolate quente com chantilly derretendo.', brinde: ['glass_choco', 'shoe_botina_baunilha'] },
  { id: 'look_bala',      cat: 'outfit', tipo: 'conjunto', name: 'Fantasia de Bala Redonda', icon: 'fa-bowling-ball',    iconColor: '#FF4757', price: 135, rarity: 'raro',
    desc: 'Translúcida, macia e com açúcar por fora.', brinde: ['glass_heart', 'shoe_croc_lilas'] },
];

const ITENS = []
  .concat(CONJUNTOS, ROUPAS, CHAPEUS, OCULOS, CALCADOS, PERUCAS, EXTRAS)
  .map((i) => Object.assign({ tipo: 'avulsa', slot: i.cat }, i, i.slot ? { slot: i.slot } : {}));

// ids duplicados quebram compra e equipamento: confira aqui.
const vistos = {};
ITENS.forEach((i) => {
  if (vistos[i.id]) throw new Error('Item repetido no guarda-roupa: ' + i.id);
  vistos[i.id] = 1;
});

const ABAS = [
  { cat: 'all',       rotulo: 'Tudo',      icone: 'fa-border-all' },
  { cat: 'look',      rotulo: 'Conjuntos', icone: 'fa-mask',       tipo: 'conjunto' },
  { cat: 'outfit',    rotulo: 'Roupas',    icone: 'fa-shirt',      exclui: 'conjunto' },
  { cat: 'shoes',     rotulo: 'Calçados',  icone: 'fa-shoe-prints' },
  { cat: 'wig',       rotulo: 'Perucas',   icone: 'fa-brush' },
  { cat: 'hat',       rotulo: 'Chapéus',   icone: 'fa-hat-wizard' },
  { cat: 'glasses',   rotulo: 'Óculos',    icone: 'fa-glasses' },
  { cat: 'accessory', rotulo: 'Extras',    icone: 'fa-wand-sparkles' },
];

// Slots na ordem em que aparecem no boneco e no salvamento.
const SLOTS = ['hat', 'wig', 'glasses', 'outfit', 'shoes', 'accessory'];
const ROTULO_SLOT = {
  hat: 'Chapéu', wig: 'Peruca', glasses: 'Óculos',
  outfit: 'Roupa', shoes: 'Calçado', accessory: 'Extra',
};

const CM_GUARDAROPA = {
  itens: ITENS,
  abas: ABAS,
  slots: SLOTS,
  rotuloSlot: ROTULO_SLOT,
  porId: function (id) {
    for (let i = 0; i < ITENS.length; i++) if (ITENS[i].id === id) return ITENS[i];
    return null;
  },
  // O que a aba mostra: 'all', uma categoria, ou os conjuntos/roupas avulsas.
  naAba: function (aba) {
    if (!aba || aba === 'all') return ITENS;
    if (aba === 'look') return ITENS.filter((i) => i.tipo === 'conjunto');
    if (aba === 'outfit') return ITENS.filter((i) => i.cat === 'outfit' && i.tipo !== 'conjunto');
    return ITENS.filter((i) => i.cat === aba && i.tipo !== 'conjunto');
  },
  equipVazio: function () {
    const e = {};
    SLOTS.forEach((s) => { e[s] = null; });
    return e;
  },
};

if (typeof module !== 'undefined' && module.exports) module.exports = CM_GUARDAROPA;
root.CM_GUARDAROPA = CM_GUARDAROPA;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));

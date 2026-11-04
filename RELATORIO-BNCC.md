# Relatório BNCC — Candy Math

> Gerado por `node testes/relatorio-bncc.js` em 04/11/2026. Não edite por mão: rode de novo. A amostragem dos geradores usa a semente fixa 20261030, então os números são repetíveis.

## 1. O que este relatório afirma — e o que ele não afirma

Ele confere **validade estrutural** do vínculo com a BNCC: código bem formado, código que existe no índice de habilidades de Matemática, ano do código igual ao ano do item, unidade temática válida e cobertura mínima por ano.

Ele **não** confere alinhamento pedagógico. Um script não decide se o enunciado é adequado para a idade, se a habilidade está sendo efetivamente desenvolvida ou se a explicação dada depois do erro é boa. Isso é leitura de professora/professor de Matemática dos anos finais e iniciais do Fundamental — ver item 6.

E ele **não** declara cobertura integral da BNCC. Os números abaixo mostram exatamente o contrário: das 247 habilidades do índice, 195 aparecem em algum lugar do jogo e 52 nunca aparecem. Uma habilidade com um único item também não está "coberta": está tocada uma vez.

## 2. De onde vem cada número

| fonte | o que é | quantidade |
| --- | --- | --- |
| `testes/bncc-matematica.txt` | índice de habilidades de Matemática copiado do documento oficial | 247 códigos em 247 linhas |
| `banco-itens.js` (`add`) | situações autorais de escolha múltipla | 311 itens |
| `banco-itens.js` (`af`) | afirmações verdadeiro/falso autorais | 96 afirmações |
| `conteudo.js` (`CM.COD`) | tabela de onde o motor tira o código de cada questão gerada | 45 temas × 9 anos |
| uso contado | referências código↔item conferidas | 710 |

## 3. Conferências estruturais

- ✓ o índice de habilidades tem uma linha por código — 247 códigos em 247 linhas
- ✓ todo código usado tem o formato EFnnMAnn — 710 referências conferidas
- ✓ todo código usado existe no índice de habilidades — nenhum código inventado
- ✓ o ano do código bate com o ano do item que o carrega — nenhuma habilidade fora de ano
- ✓ toda unidade temática usada é uma das cinco da BNCC — numeros · algebra · geometria · medidas · dados
- ✓ todo gerador entrega ao menos um código BNCC — todos
- ✓ todo gerador devolve o ano que foi pedido — todos
- ✓ o 1º ano tem conteúdo autoral — Números:17 Álgebra:0 Geometria:7 Grandezas:9 Probabilidade:7
- ✓ o 2º ano tem conteúdo autoral — Números:22 Álgebra:2 Geometria:6 Grandezas:10 Probabilidade:4
- ✓ o 3º ano tem conteúdo autoral — Números:21 Álgebra:3 Geometria:5 Grandezas:8 Probabilidade:5
- ✓ o 4º ano tem conteúdo autoral — Números:20 Álgebra:2 Geometria:5 Grandezas:11 Probabilidade:4
- ✓ o 5º ano tem conteúdo autoral — Números:20 Álgebra:3 Geometria:6 Grandezas:9 Probabilidade:5
- ✓ o 6º ano tem conteúdo autoral — Números:17 Álgebra:12 Geometria:10 Grandezas:7 Probabilidade:6
- ✓ o 7º ano tem conteúdo autoral — Números:10 Álgebra:17 Geometria:8 Grandezas:6 Probabilidade:7
- ✓ o 8º ano tem conteúdo autoral — Números:13 Álgebra:16 Geometria:4 Grandezas:8 Probabilidade:7
- ✓ o 9º ano tem conteúdo autoral — Números:7 Álgebra:14 Geometria:15 Grandezas:6 Probabilidade:6

**16 conferências aprovadas · 0 falhas.**

## 4. Cobertura por ano

| ano | itens do banco | afirmações | unidades do banco com item | unidades vistas no motor | códigos do índice sem item |
| --- | --- | --- | --- | --- | --- |
| 1º | 28 | 12 | 4 de 5 | 1 de 5 | 5 |
| 2º | 32 | 12 | 5 de 5 | 2 de 5 | 7 |
| 3º | 30 | 12 | 5 de 5 | 3 de 5 | 6 |
| 4º | 30 | 12 | 5 de 5 | 4 de 5 | 5 |
| 5º | 31 | 12 | 5 de 5 | 5 de 5 | 3 |
| 6º | 40 | 12 | 5 de 5 | 5 de 5 | 8 |
| 7º | 40 | 8 | 5 de 5 | 5 de 5 | 8 |
| 8º | 40 | 8 | 5 de 5 | 5 de 5 | 8 |
| 9º | 40 | 8 | 5 de 5 | 5 de 5 | 2 |

## 5. Itens por unidade temática e ano

| unidade | 1º | 2º | 3º | 4º | 5º | 6º | 7º | 8º | 9º | total |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Números | 17 | 22 | 21 | 20 | 20 | 17 | 10 | 13 | 7 | 147 |
| Álgebra | 0 | 2 | 3 | 2 | 3 | 12 | 17 | 16 | 14 | 69 |
| Geometria | 7 | 6 | 5 | 5 | 6 | 10 | 8 | 4 | 15 | 66 |
| Grandezas e medidas | 9 | 10 | 8 | 11 | 9 | 7 | 6 | 8 | 6 | 74 |
| Probabilidade e dados | 7 | 4 | 5 | 4 | 5 | 6 | 7 | 7 | 6 | 51 |

## 6. Onde a cobertura é fina (revisar primeiro)

- 30 códigos aparecem **uma única vez** no projeto inteiro. São a melhor lista para quem vai revisar: uma habilidade representada por um item não é uma habilidade trabalhada.
  - EF01MA03, EF01MA04, EF01MA15, EF01MA16, EF02MA02, EF02MA18, EF03MA04, EF03MA13, EF03MA26, EF04MA02, EF04MA14, EF04MA28, EF05MA04, EF05MA14, EF05MA15, EF05MA18, EF05MA22, EF06MA08, EF06MA15, EF06MA16, EF06MA18, EF06MA21, EF06MA27, EF07MA16, EF07MA19, EF07MA21, EF07MA37, EF08MA24, EF09MA01, EF09MA17

- 6 códigos aparecem com **mais de uma unidade temática**. Ou o encaixe de unidade está errado, ou o mesmo código está sendo usado para coisas diferentes. Exemplos:
  - EF02MA05: Números + Álgebra
  - EF03MA05: Números + Álgebra
  - EF03MA24: Grandezas e medidas + Números
  - EF05MA11: Álgebra + Números
  - EF06MA07: Álgebra + Números
  - EF08MA19: Grandezas e medidas + Geometria

- 52 habilidades do índice nunca são usadas. Por ano: 1º → 5 · 2º → 7 · 3º → 6 · 4º → 5 · 5º → 3 · 6º → 8 · 7º → 8 · 8º → 8 · 9º → 2.
  Exemplos: EF01MA01, EF01MA09, EF01MA11, EF01MA12, EF01MA22, EF02MA03, EF02MA10, EF02MA11, EF02MA12, EF02MA13, EF02MA17, EF02MA23, EF03MA12, EF03MA16, EF03MA17, EF03MA18, EF03MA20, EF03MA28, EF04MA08, EF04MA13.

## 7. Limites do que foi conferido

- O índice em `testes/bncc-matematica.txt` é uma cópia **sem acentos** (o arquivo é ASCII puro: as descrições perderam a acentuação na conversão). Os códigos são íntegros e conferíveis; as descrições não são citáveis assim. Este relatório por isso trabalha só com os códigos.
- Não houve, nesta auditoria, conferência linha a linha do índice contra o PDF oficial da BNCC. **Pendente:** quem publica deve conferir o índice contra o documento do MEC antes de citar qualquer habilidade.
- No motor, o código vem da tabela `CM.COD`, que associa **tema** do gerador a uma habilidade. O enunciado gerado muda de números, não de tema, então a associação é estável — mas ela é uma escolha de quem escreveu o motor, não uma verificação feita pelo sistema de ensino.
- Itens com `bncc` fora do ano do item seriam falha: nenhuma foi encontrada. Isso não significa que cada item esteja **bem** colocado: significa que o código citado pertence ao ano certo.

## 8. O que ainda falta para uma afirmação séria sobre alinhamento

- [ ] Revisão pedagógica por ano, começando pela lista do item 6 (campos preenchidos por quem ensina, não por este script).
- [ ] Conferir o índice `bncc-matematica.txt` contra o documento oficial e repor a acentuação das descrições.
- [ ] Decidir o que fazer com as 52 habilidades sem item — ampliar o banco ou declarar explicitamente que o jogo cobre um recorte.
- [ ] Leitura humana dos itens que o diagnóstico marcou como ambíguos. O que o código já fechou — e passa a conferir sozinho — são os duplicados numéricos, ou seja, questões em que duas alternativas davam a mesma resposta (corrigidos em `banco-itens.js` e nos geradores de `conteudo.js`; ver AUDITORIA.md). O que falta é saber se o enunciado é adequado para a idade, e isso nenhum script decide.

---

Nenhuma frase deste arquivo foi escrita à mão. Se um número aqui parece bom demais, rode o script e olhe a saída: `node testes/relatorio-bncc.js`.

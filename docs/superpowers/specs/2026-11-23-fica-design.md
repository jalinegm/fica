# FICA — Frequência e Indicadores de Continuidade no AVA — design

Data: 23/11/2026. Autora do produto: Jaline Mombach (docente EaD, IFFar). Contexto de produto em `PRODUCT.md`.

## 1. Intenção

Professores e tutores dos cursos técnicos EaD do IFFar exportam o log da disciplina no Moodle (AVA), abrem esta ferramenta no navegador, carregam o arquivo e veem, sem ajuda e sem IA, quem pode precisar de contato, como a turma acessou semana a semana, como as ofertas se comparam e como o acesso se relaciona com a conclusão de atividades. Os dados dos estudantes não saem do computador do professor.

A ferramenta nasce do Relatório de Formação (TCC) da autora, "Dos registros de acesso à mediação pedagógica", e calcula os mesmos indicadores usados no texto: frequência, regularidade semanal e períodos de ausência. O TCC usa a ferramenta para analisar três ofertas de Introdução à Informática (MSI EaD 2024/1, 2025/1, 2026/1) e a cita como contribuição prática.

## 2. Objetivos, não objetivos, anti-objetivos

Objetivos

- Carregar um ou mais logs (uma oferta por arquivo) e, opcionalmente, o arquivo de conclusão de atividades de cada oferta.
- Mostrar quatro abas: Quem precisa de contato (abre nesta), Diário semanal, Comparar turmas, Conclusão de atividades.
- Exportar CSV dos indicadores, imprimir ou salvar em PDF, copiar lista de estudantes para mensagem.
- Funcionar em Windows, Ubuntu e Mac, online pelo GitHub Pages e offline com o arquivo baixado.

Não objetivos

- Não se conecta ao Moodle nem usa API. Só lê arquivos exportados.
- Não guarda nada entre sessões, além de preferências sem dados pessoais (limiares, anonimização).
- Não avalia aprendizagem nem dá nota.
- Não envia mensagens; só copia a lista.

Anti-objetivos (fracasso mesmo que funcione)

- Qualquer requisição de rede depois de carregar a página, ou qualquer dado pessoal fora do computador.
- Texto que associe pouco acesso a desinteresse, preguiça ou dificuldade de aprendizagem. Padrões são sinais para mediação.
- Exigir instalação, conta ou linha de comando do professor.
- Mostrar endereço IP.

## 3. Restrições

- Página estática, sem servidor, publicada no GitHub Pages. Funciona offline quando baixada.
- Sem dependências externas em tempo de execução: nada de CDN, fontes hospedadas ou bibliotecas carregadas de fora. Uma meta CSP (`default-src 'none'`, estilos e scripts só inline/locais, `connect-src 'none'`) garante isso.
- Interface em português do Brasil.
- WCAG 2.1 AA: contraste, teclado, foco visível, gráficos com tabela equivalente.
- Visual do AVA do IFFar: barra verde, fundo creme, sem logo oficial e sem linha "feito por docente".
- O repositório nunca contém dados reais de estudantes. `.gitignore` bloqueia `*.csv`, exceto os exemplos sintéticos.

## 4. Abordagens consideradas

| Abordagem | Troca | Decisão |
|---|---|---|
| Um arquivo HTML que funciona offline, publicado no GitHub Pages | Sem instalação, roda em qualquer sistema, dados ficam no navegador; tudo em JavaScript | **Escolhida pela autora** |
| Executável .exe e pacote Linux | Cara de programa, mas 100–200 MB, alerta do Windows para programa sem assinatura, dois pacotes | Descartada |
| Script Python | Rápido de fazer, mas exige instalar Python | Descartada |

Organização da tela (escolhida na página de decisão, entre seis esboços): **abas, abrindo pela triagem** (`.impeccable/sketches/d-abas.html`). Descartadas: tela como relatório imprimível, diário sozinho, triagem sozinha, diário com triagem lateral, página única.

## 5. Formato dos arquivos de entrada (verificado com exportações reais de 2024 e 2025)

Log do curso (Relatórios > Logs > baixar CSV):

- CSV com vírgula, UTF-8 com BOM, campos entre aspas.
- Colunas: `Hora`, `Nome completo`, `Usuário afetado`, `Contexto do Evento`, `Componente`, `Nome do evento`, `Descrição`, `Origem`, `endereço IP`.
- `Hora` no formato `dd/mm/aa, HH:MM:SS` (ex.: `23/11/26, 17:18:41`).
- `Origem`: `web`, `ws` (app), `cli` (tarefas do sistema), `restore`.
- O log vai além da oferta: há acessos esparsos anos depois, inclusive da professora.
- Não há coluna de papel (estudante, professor, tutor).

Conclusão de atividades (Relatórios > Conclusão de atividades > baixar CSV):

- Primeira coluna sem nome traz o nome completo do estudante; segunda, `Endereço de email`.
- Depois, pares de colunas por atividade: estado (`Concluído` / `Não concluído`) e data/hora da conclusão (`aaaa-mm-dd HH:MM:SS`) numa coluna sem nome.
- Títulos de atividade podem ter quebras de linha dentro das aspas.
- Lista só estudantes.

Também aceitar o log em inglês (colunas `Time`, `User full name`, …), se a detecção for simples. Outros formatos (Excel, ODS) ficam fora; a tela de erro explica como exportar em CSV.

## 6. Como os dados são tratados

Estudantes

- Com arquivo de conclusão: estudantes são os nomes desse arquivo; o resto é equipe.
- Sem ele: equipe são os usuários que fazem ações de professor (`O envio foi avaliado.`, `Módulo de curso atualizado`, `Item de nota atualizado`, `Módulo do curso criado`, `Relatório de log visto` e afins). Uma lista "Participantes" permite corrigir, marcando ou desmarcando quem é equipe.
- Linhas com `Origem` `cli` ou `restore` não contam como acesso.

Lista da turma (minha decisão)

- O log só traz quem fez algo no curso. Quem nunca acessou só aparece se houver arquivo de conclusão (que lista todos os estudantes inscritos).
- Sem arquivo de conclusão, a tela avisa: "Estudantes que nunca acessaram não aparecem. Carregue a conclusão de atividades para incluí-los." O padrão "Sem acesso" só existe com esse arquivo.
- Não haverá importação da lista de participantes nesta versão.

Códigos (minha decisão): E01, E02… atribuídos em ordem alfabética do nome completo, por turma. A ferramenta e o script do TCC geram os mesmos códigos.

Período da oferta

- Proposto automaticamente: semanas em que a atividade dos estudantes é contínua (começa na primeira semana com acesso de pelo menos 20% dos estudantes e termina na última semana nessa condição).
- O professor ajusta início e fim em campos de data. Semanas começam na segunda-feira, numeradas S1, S2…
- Data de referência = fim do período ou, se a oferta ainda está em curso, o último registro do log.

Indicadores por estudante

- Acessos: número de eventos no período.
- Dias com acesso.
- Semanas com acesso / total de semanas (regularidade).
- Maior ausência: maior número de dias corridos inteiros sem nenhum acesso, considerando também do início do período até o primeiro acesso e do último acesso até a data de referência. Ausência entre dois dias com acesso = diferença em dias − 1 (acesso numa segunda e na segunda seguinte = 6 dias de ausência). Dias contados por data local, sem horário.
- Dias desde o último acesso.
- Ausências de 7, 14 e 21 dias ou mais (contagem).
- Com conclusão: atividades concluídas / total.

Padrões (regras determinísticas, nesta ordem; a primeira que vale define o padrão)

1. **Sem acesso**: nenhum acesso no período.
2. **Afastamento**: dias desde o último acesso ≥ limite de ausência (padrão 14 dias).
3. **Queda progressiva**: semanas com acesso na segunda metade ≤ 50% das da primeira metade, e a primeira metade tem pelo menos 3 semanas com acesso. Metades do período inteiro da oferta (não do estudante); com número ímpar de semanas, a semana do meio fica na primeira metade.
4. **Acesso concentrado**: semanas com acesso < 40% do total e mais da metade dos dias com acesso caem em até 2 semanas.
5. **Irregular**: semanas com acesso < 70% do total, ou alguma ausência ≥ limite.
6. **Regular**: o restante.

O limite de ausência é editável (7, 14 ou 21 dias). As regras aparecem na própria ferramenta ("Como os padrões são definidos"). Os nomes dos padrões e as estratégias sugeridas seguem a orientação do TCC:

| Padrão | Estratégia sugerida |
|---|---|
| Sem acesso / Afastamento | Contato individual para entender possíveis dificuldades |
| Queda progressiva | Acompanhamento individual e incentivo à retomada |
| Acesso concentrado | Orientação sobre rotina de estudos |
| Irregular | Lembretes e orientações periódicas |

## 7. Telas

Barra verde do AVA com o nome da ferramenta ("FICA", subtítulo "Frequência e Indicadores de Continuidade no AVA"), a turma ativa e "Carregar arquivos". Abaixo, uma linha de abas e um seletor de turma quando há mais de uma.

**Estado inicial (sem arquivo)**: área de carregamento (arrastar ou escolher) para log e conclusão; passo a passo de como exportar do Moodle; aviso "os arquivos são lidos só no seu computador"; botão "Ver exemplo com dados fictícios".

**Conferência após carregar**: nome da turma (editável, sugerido pelo `Contexto do Evento`), período proposto com datas editáveis, número de estudantes e de pessoas da equipe, com link para revisar.

**Quem precisa de contato** (abre nesta): quatro números da turma (estudantes, mediana de semanas com acesso, ausências acima do limite, afastados); colunas por padrão (Sem acesso/Afastamento, Queda progressiva, Acesso concentrado, Irregular), cada uma com contagem, estratégia sugerida, cartões de estudante (nome ou código e o dado que explica o padrão) e "Copiar lista". Regulares aparecem recolhidos. Lembrete fixo: acesso não é participação nem aprendizagem.

**Diário semanal**: matriz estudante × semana; cor = dias com acesso na semana (0 a 7, em 5 tons de verde, com legenda); última coluna com o padrão. Ordenar por nome, padrão ou semanas com acesso; filtrar por padrão. Clicar num estudante abre o detalhe: linha do tempo diária, indicadores e, se houver, atividades concluídas. Acima da matriz, gráfico de estudantes com acesso por semana. Tabela equivalente para leitores de tela.

**Comparar turmas** (com duas ou mais turmas): tabela lado a lado dos indicadores e gráfico da % de estudantes com acesso por semana de cada oferta (semanas alinhadas por número).

**Conclusão de atividades** (com arquivo de conclusão): por estudante, semanas com acesso × % de atividades concluídas (tabela e gráfico de dispersão); por atividade, % de estudantes que concluíram. Sem o arquivo: explica como exportar.

**Ajuda: "Como baixar os relatórios do Moodle"** (pedido da autora): botão "Ajuda" na barra verde e link no estado inicial. Abre uma área (painel ou página interna, não modal) com:

- passo a passo ilustrado em texto para baixar o log (Relatórios > Logs > todos os filtros > Obter estes logs > baixar CSV) e a conclusão de atividades (Relatórios > Conclusão de atividades > baixar CSV);
- um espaço para o vídeo da autora mostrando a exportação. O endereço do vídeo fica numa constante de configuração (`VIDEO_AJUDA`). Se for um arquivo no repositório (`ajuda/exportar.mp4`), toca com `<video>` e funciona offline. Se for um link do YouTube, aparece como link "Assistir ao vídeo" que abre em nova aba, para manter a página sem conexões externas. Com a constante vazia, o espaço não aparece;
- perguntas frequentes curtas: por que estudantes que nunca acessaram não aparecem, o que significa cada padrão, se os dados saem do computador.

**Exportar**: "Baixar CSV" (indicadores por estudante da turma ativa), "Imprimir / PDF" (folha de estilo de impressão com cabeçalho da turma, período, números, gráfico semanal e lista por padrão), "Mostrar códigos em vez de nomes" (E01, E02… em toda a tela, CSV e impressão).

## 7a. Gráficos: padrão Storytelling with Data (Cole Knaflic), pedido da autora

Vale para a ferramenta e para as figuras do TCC.

- **Título que diz a conclusão.** Cada gráfico tem título-mensagem, alinhado à esquerda, gerado a partir dos dados por regras simples (ex.: "A partir da semana 9, menos da metade da turma acessou o curso"; "2026/1 manteve mais estudantes acessando até o fim que 2024/1"). Abaixo, subtítulo descritivo em cinza (o que é medido e período). Os títulos descrevem o dado e nunca culpam o estudante.
- **Cinza para o contexto, uma cor para o foco.** Séries de contexto em cinza; só o que importa recebe o verde do AVA (turma ativa, semana de queda, grupo destacado). Vermelho/âmbar só onde é sinal de atenção.
- **Rótulos diretos, sem legenda.** O nome da série fica no fim da linha; valores relevantes rotulados no próprio gráfico.
- **Menos ruído.** Sem bordas, sem fundo, sem linhas de grade (ou grade cinza-claro mínima), eixos discretos em cinza, sem 3D, sem pizza, sem sombras.
- **Forma certa para cada pergunta.** Evolução semanal: linha (ou colunas com uma semana destacada). Comparação de turmas: linhas com a ativa em verde e as outras em cinza. Padrões por turma: barras horizontais ordenadas (ou 100% empilhadas com rótulo direto). Acesso × conclusão: dispersão com os pontos de atenção destacados.
- **Anotações.** Marcar no gráfico o ponto da mudança (ex.: início da queda) com uma nota curta.
- Cada gráfico tem uma tabela equivalente acessível (requisito de acessibilidade).
- As figuras do TCC (`fig_*.svg`) seguem as mesmas regras, legíveis em preto e branco (cinza + preto + verde-escuro).

## 8. Estrutura do repositório

```
fica/
  index.html            arquivo único publicado (gerado)
  src/
    core.js             leitura de CSV, datas, indicadores, padrões (funções puras)
    ui.js               telas e interação
    style.css
    template.html
  build.mjs             junta template + css + js em index.html (Node, sem dependências)
  test/core.test.mjs    testes com node:test e um log sintético
  exemplos/             logs e conclusão sintéticos (dados fictícios)
  README.md             para professores: o que é, como exportar, como usar, privacidade
  PRODUCT.md, docs/
```

O mesmo `core.js` roda no Node para gerar as tabelas e gráficos do TCC a partir dos logs reais, que ficam na pasta do TCC e nunca entram neste repositório.

Script do TCC (`tcc/gerar.mjs`, parte desta entrega, **primeira prioridade**): recebe pastas com log e conclusão de cada oferta e grava, numa pasta de saída fora do repositório:

- `indicadores_<turma>.csv`: uma linha por estudante (código, nunca nome) com todos os indicadores e o padrão.
- `resumo_turmas.csv`: por turma, n de estudantes, n de equipe excluída, período (início, fim, semanas), mediana e média de semanas com acesso, mediana de dias com acesso, mediana da maior ausência, contagem e % por padrão, contagem de ausências de 7/14/21+ dias, % de atividades concluídas (mediana).
- `semanal.csv`: por turma e semana, n e % de estudantes com acesso.
- `fig_semanal.svg` (linhas por turma, % com acesso por semana) e `fig_padroes.svg` (barras empilhadas de padrões por turma), legíveis em preto e branco, para inserir no Word.

Essa mesma tabela de resumo é a aba "Comparar turmas".

Ordem de trabalho: `core.js` + testes + script do TCC primeiro (o relatório é entregue em 24/11/2026); depois as telas.

## 9. Decidido pela autora

- Arquivo HTML único, GitHub Pages, offline.
- Visual do AVA (verde, creme), sem logo, sem linha "feito por docente".
- Abas, abrindo por "Quem precisa de contato".
- Usuários: professores e tutores EaD do IFFar.
- Funções: quem contatar, exportar/imprimir, comparar turmas, visão da turma, comparar acesso com conclusão de atividades.
- Pasta própria, separada do TCC, para virar repositório no GitHub.
- Área de ajuda com passo a passo de exportação e vídeo da autora.
- Gráficos no padrão Storytelling with Data (Cole Knaflic).
- Sem exclusão de semanas (as ofertas analisadas não tiveram recesso). Fica como melhoria futura.
- Implementação pelo Codex (`/codex:rescue`), a partir do plano.

## 10. Decidido por mim (corrigível)

- Regras e limites dos padrões (seção 6). Precisam bater com o texto do TCC.
- Semana começando na segunda-feira.
- Cor do diário = dias com acesso na semana, não número de eventos (eventos inflam com cliques).
- Detecção de equipe pelas ações de professor quando não há arquivo de conclusão.
- Pasta e repositório `fica`.

## 11. Em aberto

- Nome: **FICA — Frequência e Indicadores de Continuidade no AVA** (decidido pela autora). Lido como palavra, é o pedido ao estudante: fica no curso. Barra verde mostra "FICA" e o subtítulo "Frequência e Indicadores de Continuidade no AVA".
- Licença: CC BY-NC 4.0 (decidido pela autora).
- Turma 2026/1: exportação ainda não feita.

## 12. Para quem constrói

Escolha livre: estrutura interna do JavaScript, desenho exato dos gráficos em SVG, textos de ajuda (respeitando os anti-objetivos), atalhos de teclado.

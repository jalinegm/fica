# FICA

Frequência e Indicadores de Continuidade no AVA. Ferramenta para docentes e tutores que acompanham turmas no Moodle. A partir dos relatórios do curso, a FICA mostra quem pode precisar de contato, os acessos semana a semana, a comparação entre ofertas e a relação entre acesso e conclusão de atividades.

**Página no GitHub Pages** (endereço a configurar) `https://<usuario>.github.io/fica/`

## Baixar os relatórios no Moodle

1. No curso, abra **Relatórios → Logs**.
2. Mantenha selecionados todos os participantes, dias, atividades e demais filtros. Clique em **Obter estes logs**.
3. No fim da página, escolha **Valores separados por vírgula (.csv)** e baixe o arquivo.
4. Para incluir toda a turma e analisar as atividades, abra **Relatórios → Conclusão de atividades** no mesmo curso e baixe esse relatório em CSV.

## Analisar uma turma

1. Abra a FICA e escolha **Carregar arquivos**. Selecione ou arraste o log e, se tiver, a conclusão da mesma oferta. Clique em **Analisar**.
2. Confira o nome da turma e o período sugerido. Em **Revisar quem é equipe**, confira a classificação de professores e tutores. Clique em **Ver análise**.
3. Na aba **Quem precisa de contato**, leia os sinais de acesso e as sugestões de acompanhamento. Use **Copiar lista** para preparar um contato.
4. Consulte o **Diário semanal** e selecione um estudante para ver os dias com acesso e seus indicadores. Para comparar ofertas, carregue outro log. A aba **Conclusão de atividades** usa o relatório opcional.
5. Use **Baixar .xlsx** (planilha com uma aba de estudantes e uma aba "Sobre") ou **Imprimir / PDF** para obter o relatório da turma ativa. As exportações da página incluem os nomes dos estudantes.

Use **Ver exemplo com dados fictícios** para conhecer a ferramenta sem carregar arquivos da sua turma.

## Usar sem internet

Baixe o arquivo [index.html](index.html), salve no computador e abra com dois cliques. O navegador carrega a ferramenta a partir desse arquivo.

## Privacidade e interpretação

Os relatórios são lidos no navegador. A política de segurança de conteúdo (CSP) bloqueia conexões de rede iniciadas pela aplicação. A página descarta endereços IP e mantém os relatórios em memória enquanto está aberta. A única preferência guardada no navegador é o limite de ausência. Salve as planilhas e os PDFs exportados em um lugar apropriado para dados da turma.

Acesso ao Moodle não é o mesmo que participação ou aprendizagem. Use estes sinais para conversar com o estudante. Quem nunca acessou só aparece se você carregar o relatório de conclusão de atividades.

## Como os padrões são definidos

A primeira regra atendida na ordem abaixo define o padrão. O limite de ausência pode ser de 7, 14 ou 21 dias. O padrão da ferramenta é 14 dias.

| Padrão | Regra |
| --- | --- |
| Sem acesso | Nenhum acesso no período. Aparece com o relatório de conclusão. |
| Afastamento | Dias desde o último acesso iguais ou superiores ao limite. |
| Queda progressiva | Acesso em pelo menos três semanas da primeira metade. Na segunda metade, o número de semanas com acesso é, no máximo, metade do número da primeira. |
| Acesso concentrado | Acesso em menos de 40% das semanas e mais da metade dos dias com acesso em até duas semanas. |
| Irregular | Acesso em menos de 70% das semanas ou uma ausência igual ou superior ao limite. |
| Regular | Demais casos. |

A semana começa na segunda-feira. Em períodos com número ímpar de semanas, a semana do meio pertence à primeira metade. A contagem de ausências usa dias corridos até o fim do período ou até a data do último registro do log, o que vier primeiro.

## Desenvolvimento

Use Node.js 20 ou superior. O projeto usa apenas recursos nativos do Node e do navegador.

```sh
npm test
npm run build
```

O build gera o `index.html` na raiz. Para publicar no GitHub Pages, selecione o branch principal e a raiz como fonte. O arquivo `.nojekyll` permite servir a página diretamente.

O gerador de tabelas e figuras (usado no TCC) faz o mesmo cálculo da página. Indique uma pasta de saída fora do repositório: os logs têm dados pessoais e nunca devem ser versionados.

```sh
node tcc/gerar.mjs --turma "2025/1" --log logs_2025.csv --conclusao conclusao_2025.csv --turma "2026/1" --log logs_2026.csv --conclusao conclusao_2026.csv --out ../fica-resultados --limite 14
```

O gerador salva os indicadores por estudante identificado por código, o resumo por turma, a série semanal e duas figuras SVG.

## Licença

FICA, de Jaline Gonçalves Mombach, está sob a licença Creative Commons Atribuição–NãoComercial 4.0 Internacional. [Resumo da licença](https://creativecommons.org/licenses/by-nc/4.0/deed.pt_BR) · [Texto integral](LICENSE)

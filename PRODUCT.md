# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static HTML/CSS/JavaScript, delivered as a single self-contained HTML file that also works offline when downloaded. Hosted on GitHub Pages. No server, no build-time dependency required at run time, no AI. Chosen by the user (2026-11-23) over a Windows .exe / Linux package and a Python script, because it runs on Windows, Ubuntu and Mac with no install and no unsigned-executable warnings.

## Users

Teachers (professores) and tutors (tutores) of distance-learning (EaD) technical courses at the Instituto Federal Farroupilha (IFFar). They teach in the institution's Moodle (the "AVA"). They are not data analysts and have no AI tooling. They open the tool during or after an offering of a course (disciplina), with the course's Moodle log export in hand, to see how students are accessing the course.

Origin: built by an IFFar EaD teacher as part of her specialization final report (Relatório de Formação, Especialização em EaD na EPT), which analyses Moodle access logs of three offerings of "Introdução à Informática" (Técnico em Manutenção e Suporte em Informática EaD, 2024/1, 2025/1, 2026/1).

## Product Purpose

Turn the Moodle course log export (and, optionally, the activity completion export) into a complete view of student access that supports pedagogical follow-up and mediation (acompanhamento e mediação pedagógica). Success: a teacher uploads the file and, without help, knows which students need contact, understands the class's rhythm across the weeks, can compare offerings, and can export or print a report.

## Positioning

Runs entirely in the teacher's browser: the log file, which contains students' names, never leaves their computer. Built from the EaD pedagogy of the IFFar context: indicators are framed as signals for mediation, not as judgments of interest or learning.

## Operating Context

- Input 1: Moodle course log export (Relatórios > Logs, all participants, all days, CSV/Excel). Contains time, user full name, affected user, event context, component, event name, description, origin, IP address. Exact column names and date format depend on Moodle version and language (Portuguese in the IFFar AVA); a real sample is still needed.
- Input 2 (optional): Moodle activity completion export (Relatórios > Conclusão de atividades, CSV), to compare access with what students completed.
- Logs include teacher and tutor activity, which must be separable from student activity.
- Teachers may load several offerings to compare them.
- Outputs: on-screen view, list of students needing attention, CSV export, printable report.

## Capabilities and Constraints

- Indicators: frequency (accesses and days with access per student), regularity (weeks with at least one access over the course's weeks), absence periods (longest gap; counts of 7, 14, 21+ days without access), weekly distribution of access, patterns (regular, concentrated in few days, progressive decline, withdrawal in final weeks).
- Access compared with activity completion when the completion file is provided.
- Multiple offerings comparable side by side.
- Students needing attention listed for contact.
- Export CSV and print/PDF report.
- Privacy: all processing local; option to anonymize names (codes) for reports and screenshots; IP addresses never shown.
- Interface in Brazilian Portuguese.
- Name: FICA — Frequência e Indicadores de Continuidade no AVA. License: CC BY-NC 4.0.
- Undecided: thresholds defaults beyond 7/14/21 days; how teacher/tutor accounts are separated from students (from the log alone or with a participants list).

## Brand Commitments

Use only the color world of the IFFar AVA (green header, cream background, as in the institution's Moodle). No official IFFar logo. No "made by a teacher / not official" line in the footer (user decision).

## Evidence on Hand

No log sample in the project yet (`02_dados/moodle_brutos/` is empty). Do not fabricate example data presented as real; any demo data must be clearly synthetic.

## Product Principles

1. Access is a signal, not a verdict: wording never equates low access with lack of interest or learning difficulty.
2. Students' data stays on the teacher's machine.
3. A teacher with no data background gets to "who do I contact" in one upload.
4. Same indicators the report (TCC) uses, so the tool and the study agree.

## Accessibility & Inclusion

Public-sector educational tool: target WCAG 2.1 AA (contrast, keyboard use, readable charts with table alternatives).

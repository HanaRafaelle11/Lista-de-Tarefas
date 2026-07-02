# MyFlowDay Design System

Este diretório contém a especificação e implementação centralizada de identidades visuais, paletas de cores, caminhos de marcas e componentes primitivos (*UI Primitives*) do MyFlowDay.

## 🧱 Estrutura
- `/theme`: Tokens de cores, bordas arredondadas e o hook `useTheme`.
- `/branding`: Utilitário `getLogo` para resolver o caminho correto dos logotipos sem filtros CSS.
- `/ui`: Primitivas reutilizáveis (`Button`, `Input`, `Modal`, `Card`, `Spinner`).
- `/layout`: Componentes de estrutura de tela (`Page`, `Container`).

## 🚨 Regras do Sistema

### 🔴 Proibido
- **CSS Filters** no logotipo (ex: `filter: invert()`, `brightness()`) para clarear marcas em fundos escuros. Sempre utilize o asset correto programaticamente.
- **Logotipo Hardcoded** nos componentes. Use sempre `getLogo(theme)`.
- **Botões e Modais Recriados Ad-hoc** com folhas de estilos ou inline customizados fora dos componentes primitivos.

### 🟢 Obrigatório
- Consumir o hook `useTheme()` para obter cores do tema atual (`light`/`dark`).
- Utilizar `getLogo(mode)` para renderizar a marca oficial.
- Utilizar `<Button>`, `<Input>`, `<Card>` e `<Modal>` para garantir coerência visual em toda a plataforma.

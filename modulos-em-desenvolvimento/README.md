# Módulos em desenvolvimento

Pasta para desenvolver partes importantes do ClubOS **à parte**, com foco total, e depois integrar — mesmo padrão do **ClubOS Pulse**.

## Como usar

1. Copie `_template/` para uma pasta nova: `modulos-em-desenvolvimento/<nome>/`
2. Preencha `CLUBOS_CONEXAO.md`, `CURSOR_MANUAL.md` e `MELHORIAS_FUTURAS.md`
3. Prototipe o motor/UI aqui (ou em subpasta) até validar
4. No chat do ClubOS, peça a integração apontando esta pasta
5. O agente deve seguir a skill **clubos-novo-modulo**

## Exemplo já integrado

| Módulo | Pasta protótipo | Destino no app |
|--------|-----------------|----------------|
| Pulse | `clubos/ClubOS Pulse/projeto-carreira/` | `src/pulse/` + páginas Pulse |

## Convenções

- Nome de produto claro (ex.: **ClubOS Pulse**)
- Nome curto / rota em minúsculas (ex.: `pulse`)
- ClubOS dono de clube/elenco/temporada — o módulo não duplica cadastro
- Motor puro (sem DOM) facilita a portagem
- MVP de integração ≠ backlog de melhorias futuras

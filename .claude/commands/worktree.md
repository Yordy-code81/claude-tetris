---
description: Crea un git worktree aislado en .trees/<nombre> y ejecuta allí el requerimiento
argument-hint: <requerimiento a implementar>
allowed-tools: Bash(git worktree:*), Bash(git branch:*), Bash(git status:*), Bash(git -C:*), Bash(mkdir:*), Bash(ls:*)
---

# /worktree

Requerimiento recibido:

$ARGUMENTS

## Pasos

1. **Validar entrada.** Si el requerimiento está vacío, pide al usuario que lo describa y detente.

2. **Determinar el nombre.** A partir del requerimiento, genera un nombre corto en kebab-case
   (2 a 4 palabras, solo `a-z`, `0-9` y `-`, sin acentos). Ejemplos:
   - "añadir sonido al limpiar líneas" → `sonido-lineas`
   - "corregir bug de rotación en la pared" → `fix-rotacion-pared`

   Si `.trees/<nombre>` o la rama `<nombre>` ya existen (`git worktree list`, `git branch --list <nombre>`),
   añade un sufijo `-2`, `-3`, etc.

3. **Asegurar que `.trees/` está ignorado.** Si `.trees/` no aparece en `.gitignore`, añádelo.

4. **Crear el worktree** desde la raíz del repositorio principal, con una rama nueva del mismo nombre:

   ```bash
   git worktree add .trees/<nombre> -b <nombre>
   ```

   Confirma con `git worktree list`.

5. **Trabajar SOLO dentro del worktree.** Toda la implementación del requerimiento ocurre en
   `<raíz del repo>/.trees/<nombre>/`:
   - Usa rutas absolutas dentro de `.trees/<nombre>/` en Read, Edit, Write, Glob y Grep.
   - Usa `git -C .trees/<nombre> ...` para comandos de git.
   - **No** modifiques archivos del árbol principal (fuera de `.trees/`), salvo `.gitignore` en el paso 3.
   - Sigue las convenciones de `CLAUDE.md` (textos de UI en español, IDs del DOM sincronizados, etc.).

6. **Implementar el requerimiento** completo dentro del worktree.

7. **Commit en la rama del worktree** con un mensaje convencional en español
   (p. ej. `feat: ...`, `fix: ...`), usando `git -C .trees/<nombre> commit`. No hagas push ni PR
   salvo que el usuario lo pida.

8. **Informar al usuario:**
   - Nombre del worktree y de la rama.
   - Ruta: `.trees/<nombre>`.
   - Resumen de los cambios y archivos tocados.
   - Cómo probarlo: `cd .trees/<nombre> && python3 -m http.server 8000`.
   - Cómo limpiarlo: `git worktree remove .trees/<nombre>` y `git branch -d <nombre>`.

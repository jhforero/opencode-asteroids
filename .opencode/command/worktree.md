---
description: Crea un git worktree en .worktrees/<nombre> a partir del argumento recibido
agent: build
---

Recibirás este argumento: "$ARGUMENTS"

Deriva un nombre de worktree a partir de él: minúsculas, sin espacios (reemplázalos por guiones) y sin caracteres especiales.

Ejecuta EXACTAMENTE un comando, sin cambiar de directorio y sin agregar nada más:

git worktree add .worktrees/<nombre>

Reemplaza <nombre> por el nombre derivado. No uses -b, no te muevas de carpeta, no corras comandos adicionales. Devuelve únicamente la salida del comando.

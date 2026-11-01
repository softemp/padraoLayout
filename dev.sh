#!/usr/bin/env bash
# dev.sh — sobe o frontend do padraoLayout (Vite) num comando.
#
# Portas (convencao SoftEmp: backend = frontend + 1, par contiguo, exclusivo deste projeto
# no Base_Infra_Portas_Registro do Cofre):
#   Frontend  http://localhost:5273  (Vite, strictPort)
#   Backend   5274 RESERVADA — o projeto e' so' frontend (nao sobe nada nela; fora de PORTAS)
#
# Uso:
#   ./dev.sh          # sobe; porta ocupada por processo DESTE projeto -> pergunta se encerra
#   ./dev.sh --kill   # encerra sem perguntar os processos deste projeto que seguram a porta
set -euo pipefail

cd "$(dirname "$0")"
RAIZ="$(pwd -P)"

FRONTEND_PORT=5273
BACKEND_PORT=$((FRONTEND_PORT + 1))
PORTAS=("$FRONTEND_PORT")

MATAR=0
for arg in "$@"; do
  case "$arg" in
    -k|--kill) MATAR=1 ;;
    -h|--help) sed -n '2,11p' "$0"; exit 0 ;;
    *) echo "dev.sh: opcao desconhecida: $arg (use --help)" >&2; exit 1 ;;
  esac
done

command -v ss >/dev/null 2>&1 || { echo "dev.sh: ss nao encontrado (pacote iproute2)" >&2; exit 1; }

# ── Portas: so' encerra processo DESTE projeto ─────────────────────────────────
# A porta e' exclusiva do projeto (registro do Cofre), mas quem esta' nela pode nao ser:
# o dono e' decidido pela pasta do processo (/proc/<pid>/cwd dentro de $RAIZ), nunca
# pelo numero da porta. Processo de outro projeto/usuario = conflito de registro: so' avisa.
porta_ocupada() { ss -ltnH "sport = :$1" 2>/dev/null | grep -q .; }
pids_da_porta() { ss -ltnpH "sport = :$1" 2>/dev/null | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u; }
pasta_do()      { readlink "/proc/$1/cwd" 2>/dev/null || true; }
comando_do()    { tr '\0' ' ' <"/proc/$1/cmdline" 2>/dev/null | cut -c1-100 || true; }
pai_do()        { sed 's/^.*) //' "/proc/$1/stat" 2>/dev/null | cut -d' ' -f2 || true; }  # comm pode ter espaco/parenteses

do_projeto() {
  local pasta; pasta="$(pasta_do "$1")"
  [[ "$pasta" == "$RAIZ" || "$pasta" == "$RAIZ/"* ]]
}

# Sobe pelos pais enquanto ainda forem processos de dev deste projeto (dev.sh velho, npm,
# tsx watch, vite, sh -c): encerrar a raiz da arvore derruba o conjunto, nao so' o filho
# que segura a porta (senao o watcher velho fica orfao). Para no shell interativo e em si.
raiz_da_arvore() {
  local pid="$1" pai
  while :; do
    pai="$(pai_do "$pid")"
    [[ -n "$pai" && "$pai" -gt 1 && "$pai" -ne $$ ]] || break
    do_projeto "$pai" || break
    case "$(comando_do "$pai")" in
      *dev.sh*|npm\ *|node\ *|sh\ -c\ *|*tsx*|*vite*) pid="$pai" ;;
      *) break ;;
    esac
  done
  echo "$pid"
}

descendentes() {
  local filho
  for filho in $(ps -o pid= --ppid "$1" 2>/dev/null); do
    echo "$filho"; descendentes "$filho"
  done
}

OCUPADAS=() ; ALVOS=() ; ALHEIO=0
for p in "${PORTAS[@]}"; do
  porta_ocupada "$p" || continue
  OCUPADAS+=("$p")
  pids="$(pids_da_porta "$p")"
  if [[ -z "$pids" ]]; then
    echo "dev.sh: porta $p em uso por processo de outro usuario (sem acesso ao PID)." >&2
    ALHEIO=1; continue
  fi
  for pid in $pids; do
    if do_projeto "$pid"; then
      echo "dev.sh: porta $p em uso por este projeto — PID $pid: $(comando_do "$pid")" >&2
      ALVOS+=("$(raiz_da_arvore "$pid")")
    else
      echo "dev.sh: porta $p em uso por OUTRO projeto — PID $pid: $(comando_do "$pid")" >&2
      echo "         pasta: $(pasta_do "$pid")" >&2
      ALHEIO=1
    fi
  done
done

if [[ ${#OCUPADAS[@]} -gt 0 ]]; then
  if [[ $ALHEIO -eq 1 ]]; then
    echo "dev.sh: conflito no registro de portas (Base_Infra_Portas_Registro) — nada foi encerrado." >&2
    echo "         Pare o outro processo ou corrija o par de portas do projeto dono dele." >&2
    exit 1
  fi
  if [[ $MATAR -eq 0 ]]; then
    if [[ ! -t 0 ]]; then
      echo "dev.sh: sem terminal para perguntar — rode ./dev.sh --kill para encerrar." >&2
      exit 1
    fi
    read -rp "Encerrar esses processos deste projeto e continuar? [k = encerrar / q = sair] " escolha
    [[ "${escolha,,}" == k* ]] || { echo "dev.sh: nada encerrado." >&2; exit 1; }
  fi

  # Arvore inteira de cada alvo: TERM, ate' 3 s para as portas liberarem, KILL em quem resistiu.
  TODOS=()
  for raiz in $(printf '%s\n' "${ALVOS[@]}" | sort -u); do
    TODOS+=("$raiz" $(descendentes "$raiz"))
  done
  kill -TERM "${TODOS[@]}" 2>/dev/null || true
  for _ in 1 2 3 4 5 6; do
    livre=1; for p in "${OCUPADAS[@]}"; do porta_ocupada "$p" && livre=0; done
    [[ $livre -eq 1 ]] && break
    sleep 0.5
  done
  kill -KILL "${TODOS[@]}" 2>/dev/null || true
  sleep 0.5
  for p in "${OCUPADAS[@]}"; do
    if porta_ocupada "$p"; then
      echo "dev.sh: porta $p continua ocupada — abortando." >&2
      exit 1
    fi
  done
  echo "dev.sh: portas ${OCUPADAS[*]} liberadas."
fi

# Derruba todos os processos juntos: Ctrl-C, ou a morte de um, encerra os outros
# (kill 0 = todo o grupo de processos deste script).
trap 'kill 0' EXIT

npm run dev &

# Retorna assim que o PRIMEIRO cair; o trap EXIT limpa o restante.
wait -n

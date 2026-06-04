#!/bin/bash
# Cria o repositório no GitHub e faz o push inicial
# Uso: GITHUB_TOKEN=seu_token bash create-github-repo.sh

REPO_NAME="jusconsulta-tjsp"
REPO_DESC="Consulta processual ampliada para o TJSP — busca por nome, CPF/CNPJ e número do processo nos sistemas 1º Grau, 2º Grau e Colégio Recursal"
GITHUB_USER=$(curl -s -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/user | grep '"login"' | head -1 | awk -F'"' '{print $4}')

echo "Criando repositório '$REPO_NAME' para usuário '$GITHUB_USER'..."

curl -s -X POST \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Content-Type: application/json" \
  https://api.github.com/user/repos \
  -d "{
    \"name\": \"$REPO_NAME\",
    \"description\": \"$REPO_DESC\",
    \"private\": false,
    \"auto_init\": false
  }" | grep -E '"html_url"|"clone_url"|"message"'

echo ""
echo "Configurando remote e fazendo push..."
git remote add origin "https://${GITHUB_TOKEN}@github.com/${GITHUB_USER}/${REPO_NAME}.git"
git push -u origin main

echo ""
echo "✅ Repositório disponível em: https://github.com/${GITHUB_USER}/${REPO_NAME}"

# Configuração dos Secrets para build do APK

Antes de rodar o workflow, adicione os seguintes secrets em:
**GitHub → Settings → Secrets and variables → Actions → New repository secret**

## Secrets necessários

| Secret | Descrição |
|---|---|
| `KEYSTORE_BASE64` | Keystore em base64 (ver instruções abaixo) |
| `KEYSTORE_PASSWORD` | Senha do keystore |
| `KEY_ALIAS` | Alias da chave (ex: `jusconsulta`) |
| `KEY_PASSWORD` | Senha da chave (pode ser igual ao keystore) |

## Como gerar o Keystore (uma única vez)

Execute no terminal (com Java instalado):

```bash
keytool -genkey -v \
  -keystore release.keystore \
  -alias jusconsulta \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -dname "CN=Kleber Gitti, OU=TecTor, O=TecTor Projetos, L=Santo Andre, ST=SP, C=BR"
```

## Converter keystore para base64

```bash
base64 -w 0 release.keystore
```

Cole a saída no secret `KEYSTORE_BASE64`.

## Guardar o keystore

⚠️ Guarde o arquivo `release.keystore` e as senhas em local seguro.
Se perder, não poderá atualizar o app na Play Store.

## Acionar o build

- **Push para main** → gera APK de desenvolvimento
- **Tag `v*`** → gera APK + cria Release no GitHub automaticamente

```bash
git tag v1.0.0
git push origin v1.0.0
```

# Console de test — Assistant portfolio

Interface de chat statique (HTML/CSS/JS, sans dépendance) pour tester le proxy
AWS Lambda vers l'API Anthropic.

## Fonctionnement

L'interface envoie la question de l'utilisateur à la Function URL :

```
POST {URL_LAMBDA}
Content-Type: application/json

{"question": "..."}
```

et affiche la réponse :

| Statut | Corps                | Affichage                          |
|--------|----------------------|------------------------------------|
| 200    | `{"answer": "..."}`  | Bulle de réponse (markdown simple) |
| 400    | `{"error": "..."}`   | Bulle d'erreur                     |
| 502    | `{"error": "..."}`   | Bulle d'erreur                     |

Le volet **journal des requêtes** trace chaque appel : statut HTTP, latence,
corps de la requête et de la réponse — pratique pour déboguer la Lambda.

Limite de question : 3000 caractères (alignée sur `MAX_QUESTION_CHARS` côté Lambda).

### Surcharger l'endpoint

Pour tester une autre URL sans modifier le code :

```
https://<votre-page>/?endpoint=https://autre-fonction.lambda-url.eu-west-1.on.aws/
```

## Déploiement sur GitHub Pages

1. Créer un dépôt GitHub et pousser ces fichiers :

   ```bash
   git init
   git add index.html styles.css app.js README.md
   git commit -m "Interface de test du proxy Lambda"
   git branch -M main
   git remote add origin https://github.com/<utilisateur>/<depot>.git
   git push -u origin main
   ```

2. Sur GitHub : **Settings → Pages → Build and deployment** →
   Source : *Deploy from a branch* → Branch : `main` / `/ (root)` → **Save**.

3. La page est publiée sous `https://<utilisateur>.github.io/<depot>/`
   (compter une à deux minutes pour la première publication).

> **CORS** : la Function URL doit autoriser l'origine GitHub Pages
> (`https://<utilisateur>.github.io`) ou `*`, avec la méthode `POST` et
> l'en-tête `content-type`. C'est configuré côté AWS (Function URL → CORS),
> pas dans ce code.

## Test en local

Ouvrir `index.html` directement dans un navigateur, ou servir le dossier :

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

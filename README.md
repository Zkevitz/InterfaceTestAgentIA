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

## Test en local

Ouvrir `index.html` directement dans un navigateur, ou servir le dossier :

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

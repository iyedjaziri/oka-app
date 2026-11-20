# OKA – voix naturelle hors ligne (Piper)

OKA parle maintenant avec une voix neuronale française, **fr_FR-siwis-medium** (Piper). Cette voix est gratuite, sans clé API, et tourne entièrement dans le navigateur, en WebAssembly avec ONNX Runtime.

## 1. Lancer la démo (important)

Ouvrir le fichier par double-clic (`file://…`) **ne suffit pas pour la voix Piper**. Dans ce mode, le navigateur refuse le cache dont la voix a besoin. OKA le détecte, affiche un message et parle avec la voix du navigateur. Tout le reste marche normalement.

Pour avoir la voix naturelle, servez la page en local :

```bash
cd dossier/qui/contient/le/fichier
python -m http.server 8000        # ou : python3 -m http.server 8000
```

Puis ouvrez **http://localhost:8000/OKA-avatar-parlant-4.html** dans Chrome ou Edge.
Utilisez bien `localhost` : une adresse comme `http://192.168.x.x` n'est pas considérée comme sécurisée, et le cache y est refusé.

## 2. Premier chargement

- Au démarrage, la pastille **« Préparation de la voix d'OKA… xx % »** apparaît en bas à gauche de l'avatar. Le téléchargement fait environ **93 Mo** et n'a lieu qu'une seule fois : 63 Mo pour la voix, 18 Mo pour le dictionnaire de prononciation et 11 Mo pour le moteur ONNX.
- Pendant ce temps, OKA parle avec la voix du navigateur. Rien n'est bloqué.
- Quand la pastille disparaît, la voix naturelle prend le relais. OKA prépare aussi à l'avance quelques phrases fréquentes : la salutation, « Je n'ai pas bien compris… » et le choix du niveau des jeux.

## 3. Mode hors ligne

- Tous les fichiers (modèle, WASM, scripts) sont gardés dans le **Cache Storage** du navigateur, sous le nom `oka-voix-piper-v1`. OKA demande aussi au navigateur de ne pas effacer ce cache.
- Dans **Réglages → Voix**, le bouton **« Télécharger la voix pour le hors-ligne »** lance le téléchargement avec une barre de progression. Quand tout est prêt, le message « Voix naturelle prête : OKA peut parler sans internet » s'affiche.
- Pour vérifier : chargez la page une fois avec internet et attendez « Voix naturelle prête ». Coupez ensuite le Wi-Fi et rechargez la page. Ouvrez Réglages, puis cliquez sur **Tester la voix**. OKA doit dire « Bonjour Giselle. Vendredi, vous avez rendez-vous à dix heures trente » avec la voix Piper.
- La page elle-même doit rester accessible. Laissez donc tourner `python -m http.server`, qui est local et n'a pas besoin d'internet.

## 4. Changer de voix ou de vitesse

Dans **Réglages → Voix** :

| Réglage | Effet |
|---|---|
| **Voix d'OKA → Naturelle hors ligne (Piper)** | Réglage par défaut. Si Piper n'est pas prêt ou tombe en erreur, OKA prend la voix du navigateur. |
| **Voix d'OKA → Voix du navigateur** | Web Speech API, comme avant. On peut choisir une voix précise dans « Voix du navigateur ». |
| **Voix d'OKA → Voix clonée (ElevenLabs)** | Il faut une clé et un ID de voix ElevenLabs (service payant, facultatif). En cas d'erreur, OKA passe à Piper, puis à la voix du navigateur. |
| **Vitesse** | 0,85 par défaut. Pour Piper, `length_scale = 1 / vitesse` : 0,85 donne 1,18 (plus posé). |

**Tester la voix** utilise le moteur et la vitesse affichés dans le formulaire, même avant de cliquer sur **Enregistrer**.

## 5. En cas de problème

- La pastille reste affichée ou une erreur apparaît dans Réglages : ouvrez la console (F12) et cherchez les messages « Piper : ».
- Pour repartir de zéro : F12 → Application → Cache Storage → supprimez `oka-voix-piper-v1`.
- Fichiers utilisés (versions figées) :
  - `onnxruntime-web@1.18.0`, `@diffusionstudio/piper-wasm@1.0.0` (cdn.jsdelivr.net)
  - `rhasspy/piper-voices` révision `v1.0.0` (huggingface.co), avec `diffusionstudio/piper-voices` comme miroir de secours

"""Pré-génère les phrases fixes d'OKA avec Pocket TTS (modèle français allégé).

Lit app/audio/voix/phrases.json ({clé: phrase}), écrit app/audio/voix/<voix>/<clé>.wav (16 kHz, mono)
et app/audio/voix/index.json. Les phrases déjà générées sont gardées. Lancé par : npm run voix:clips
"""
import json
import sys
import time
import wave
from pathlib import Path

import numpy as np
from scipy.signal import resample_poly
from pocket_tts import TTSModel

DOSSIER = Path(__file__).resolve().parents[2] / "app" / "audio" / "voix"
VOIX = sys.argv[1] if len(sys.argv) > 1 else "estelle"

phrases = json.loads((DOSSIER / "phrases.json").read_text(encoding="utf-8"))
sortie = DOSSIER / VOIX
sortie.mkdir(parents=True, exist_ok=True)
a_faire = {k: p for k, p in phrases.items() if not (sortie / f"{k}.wav").exists()}
print(f"{len(phrases)} phrases fixes, {len(a_faire)} à générer avec la voix « {VOIX} »", flush=True)

if a_faire:
    modele = TTSModel.load_model(language="french", quantize=True)
    etat = modele.get_state_for_audio_prompt(VOIX)
    for i, (cle, phrase) in enumerate(a_faire.items(), 1):
        t0 = time.time()
        audio = modele.generate_audio(etat, phrase).squeeze().numpy()
        audio = resample_poly(audio, 2, 3)  # 24 kHz -> 16 kHz : fichiers plus légers, voix intacte
        pcm = (np.clip(audio, -1, 1) * 32767).astype(np.int16)
        with wave.open(str(sortie / f"{cle}.wav"), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(16000)
            w.writeframes(pcm.tobytes())
        print(f"[{i}/{len(a_faire)}] {time.time() - t0:.1f} s · {phrase[:60]}", flush=True)

# index : seules les phrases présentes et encore utilisées
garde = {k: True for k in phrases if (sortie / f"{k}.wav").exists()}
(DOSSIER / "index.json").write_text(json.dumps({"voix": VOIX, "phrases": garde}, ensure_ascii=False), encoding="utf-8")
print(f"index : {len(garde)} phrases prêtes dans app/audio/voix/{VOIX}/", flush=True)

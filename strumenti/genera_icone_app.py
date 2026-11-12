"""
genera_icone_app.py

Crea le icone per installare la bacheca e l'area educatori sul telefono
come app (PWA). Va rilanciato ogni volta che cambia il logo.

Uso, dalla cartella principale del progetto:
    python3 strumenti/genera_icone_app.py

Ingresso:  il primo file trovato tra
             risorse_grafiche/marchio_oratorio.svg  (simbolo, consigliato)
             risorse_grafiche/marchio_oratorio.png
             risorse_grafiche/logo_oratorio.png
           (se non ce n'e' nessuno, disegna un segnaposto)
Uscita:    risorse_grafiche/icone/
             icona_bacheca_192.png, icona_bacheca_512.png, icona_bacheca_apple_180.png
             icona_educatori_192.png, icona_educatori_512.png, icona_educatori_apple_180.png

Le icone degli educatori hanno in basso l'etichetta "EDU", per distinguerle
sulla schermata del telefono. Il contenuto resta nella "zona sicura" centrale
(cerchio di raggio pari al 40% del lato), cosi' Android puo' ritagliare
l'icona in qualsiasi forma (purpose "maskable").

Richiede Pillow (pip install Pillow). Per leggere un file SVG serve anche
uno di questi: il modulo Python cairosvg (pip install cairosvg), il comando
rsvg-convert (pacchetto librsvg2-bin) oppure ImageMagick (magick/convert).
"""
import io
import shutil
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

CARTELLA_PROGETTO = Path(__file__).resolve().parent.parent
CARTELLA_RISORSE = CARTELLA_PROGETTO / "risorse_grafiche"
PERCORSI_LOGO_POSSIBILI = [
    CARTELLA_RISORSE / "marchio_oratorio.svg",
    CARTELLA_RISORSE / "marchio_oratorio.png",
    CARTELLA_RISORSE / "logo_oratorio.png",
]
CARTELLA_ICONE = CARTELLA_PROGETTO / "risorse_grafiche" / "icone"

LATO_DI_LAVORO = 1024                 # le icone si disegnano grandi e poi si riducono
COLORE_SFONDO = (255, 255, 255)
COLORE_PRINCIPALE = (0, 193, 12)      # #00c10c, verde del marchio (--colore-marchio)
COLORE_ETICHETTA = (0, 141, 0)        # #008d00, verde dei pulsanti (--colore-accento): testo bianco leggibile
TESTO_ETICHETTA_EDUCATORI = "EDU"
DIMENSIONI_ICONE = {"192": 192, "512": 512, "apple_180": 180}


def converti_svg_in_immagine(percorso_svg, lato):
    """Converte un SVG in immagine Pillow (RGBA) con il primo strumento disponibile."""
    try:
        import cairosvg
        dati_png = cairosvg.svg2png(url=str(percorso_svg), output_height=lato)
        return Image.open(io.BytesIO(dati_png)).convert("RGBA")
    except ImportError:
        pass
    comandi = []
    if shutil.which("rsvg-convert"):
        comandi.append(["rsvg-convert", "-h", str(lato), str(percorso_svg)])
    for nome_comando in ("magick", "convert"):
        if shutil.which(nome_comando):
            comandi.append([nome_comando, "-background", "none", "-density", "600",
                            str(percorso_svg), "-resize", f"x{lato}", "png:-"])
            break
    for comando in comandi:
        risultato = subprocess.run(comando, capture_output=True)
        if risultato.returncode == 0 and risultato.stdout:
            return Image.open(io.BytesIO(risultato.stdout)).convert("RGBA")
    raise SystemExit("Impossibile leggere " + str(percorso_svg) + ": installare cairosvg "
                     "(pip install cairosvg) oppure librsvg2-bin o ImageMagick.")


def carica_logo_o_segnaposto(lato):
    """Restituisce il logo quadrato (RGBA, lato x lato) o un segnaposto disegnato."""
    percorso_logo = next((p for p in PERCORSI_LOGO_POSSIBILI if p.exists()), None)
    if percorso_logo is not None:
        if percorso_logo.suffix.lower() == ".svg":
            logo = converti_svg_in_immagine(percorso_logo, lato)
        else:
            logo = Image.open(percorso_logo).convert("RGBA")
        logo.thumbnail((lato, lato), Image.LANCZOS)
        quadrato = Image.new("RGBA", (lato, lato), (0, 0, 0, 0))
        quadrato.paste(logo, ((lato - logo.width) // 2, (lato - logo.height) // 2), logo)
        return quadrato
    print("Nessun logo trovato in", CARTELLA_RISORSE, "- uso un segnaposto.")
    segnaposto = Image.new("RGBA", (lato, lato), (0, 0, 0, 0))
    disegno = ImageDraw.Draw(segnaposto)
    spessore = lato // 14
    disegno.ellipse([lato * 0.32, lato * 0.10, lato * 0.68, lato * 0.46], outline=COLORE_PRINCIPALE, width=spessore)
    disegno.arc([lato * 0.12, lato * 0.56, lato * 0.88, lato * 1.30], 200, 340, fill=COLORE_PRINCIPALE, width=spessore)
    return segnaposto


def carica_carattere_grassetto(dimensione):
    """Cerca un carattere grassetto comune; altrimenti usa quello incluso in Pillow."""
    for nome in ("DejaVuSans-Bold.ttf", "Arial Bold.ttf", "arialbd.ttf", "Poppins-SemiBold.ttf"):
        try:
            return ImageFont.truetype(nome, dimensione)
        except OSError:
            continue
    return ImageFont.load_default(size=dimensione)


def disegna_icona(con_etichetta_educatori):
    """Disegna l'icona alla dimensione di lavoro."""
    lato = LATO_DI_LAVORO
    icona = Image.new("RGBA", (lato, lato), COLORE_SFONDO + (255,))
    lato_logo = int(lato * (0.50 if con_etichetta_educatori else 0.62))
    alto_logo = int(lato * 0.17) if con_etichetta_educatori else (lato - lato_logo) // 2
    logo = carica_logo_o_segnaposto(lato_logo)
    icona.paste(logo, ((lato - lato_logo) // 2, alto_logo), logo)

    if con_etichetta_educatori:
        disegno = ImageDraw.Draw(icona)
        larghezza, altezza = lato * 0.40, lato * 0.15
        sinistra, alto = (lato - larghezza) / 2, lato * 0.70
        disegno.rounded_rectangle([sinistra, alto, sinistra + larghezza, alto + altezza],
                                  radius=altezza / 2, fill=COLORE_ETICHETTA)
        carattere = carica_carattere_grassetto(int(altezza * 0.62))
        disegno.text((lato / 2, alto + altezza / 2), TESTO_ETICHETTA_EDUCATORI,
                     fill=(255, 255, 255), font=carattere, anchor="mm")
    return icona.convert("RGB")


def genera_tutte_le_icone():
    CARTELLA_ICONE.mkdir(parents=True, exist_ok=True)
    for nome_app, con_etichetta in (("bacheca", False), ("educatori", True)):
        grande = disegna_icona(con_etichetta)
        for suffisso, dimensione in DIMENSIONI_ICONE.items():
            destinazione = CARTELLA_ICONE / f"icona_{nome_app}_{suffisso}.png"
            grande.resize((dimensione, dimensione), Image.LANCZOS).save(destinazione, optimize=True)
            print("Creata", destinazione.relative_to(CARTELLA_PROGETTO))


if __name__ == "__main__":
    genera_tutte_le_icone()

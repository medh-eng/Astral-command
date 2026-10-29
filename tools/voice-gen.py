#!/usr/bin/env python3
"""Generate Sanjaya's voice lines with Sarvam AI Bulbul.

    SARVAM_API_KEY=... python3 tools/voice-gen.py --lang both --speaker ashutosh

Reads docs/voice/sanjaya-lines.csv and writes assets/audio/voice/{hi,en}/<id>.mp3.
The key is read from the environment; it is never written to disk.
"""
import argparse, base64, csv, json, os, subprocess, sys, time, urllib.error, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = 'https://api.sarvam.ai/text-to-speech'
COLS = {'hi': ('hi-IN', 'hindi_voice_text'), 'en': ('en-IN', 'english_voice_text')}


def ffmpeg():
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return 'ffmpeg'


def speak(key, text, code, speaker, pace):
    body = json.dumps({"text": text, "target_language_code": code, "speaker": speaker,
                       "model": "bulbul:v3", "pace": pace, "speech_sample_rate": 44100}).encode()
    req = urllib.request.Request(API, data=body,
                                 headers={'api-subscription-key': key, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=120) as r:
        return base64.b64decode(json.loads(r.read())['audios'][0])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--lang', default='both', choices=['hi', 'en', 'both'])
    ap.add_argument('--speaker', default='ashutosh')
    ap.add_argument('--pace', type=float, default=0.9)
    ap.add_argument('--ids', default='', help='comma-separated ids to re-record')
    args = ap.parse_args()

    key = os.environ.get('SARVAM_API_KEY')
    if not key:
        sys.exit('SARVAM_API_KEY is not set')
    ff = ffmpeg()
    rows = list(csv.DictReader(open(os.path.join(ROOT, 'docs/voice/sanjaya-lines.csv'), encoding='utf-8-sig')))
    want = {i.strip() for i in args.ids.split(',') if i.strip()}
    langs = ['hi', 'en'] if args.lang == 'both' else [args.lang]
    ok = fail = 0
    for lang in langs:
        code, col = COLS[lang]
        outdir = os.path.join(ROOT, 'assets/audio/voice', lang)
        os.makedirs(outdir, exist_ok=True)
        for row in rows:
            if want and row['id'] not in want:
                continue
            text = (row.get(col) or '').strip()
            if not text:
                continue
            wav = os.path.join('/tmp', 'vyuha_' + row['id'] + '.wav')
            mp3 = os.path.join(outdir, row['id'] + '.mp3')
            for attempt in range(3):
                try:
                    open(wav, 'wb').write(speak(key, text, code, args.speaker, args.pace))
                    subprocess.run([ff, '-v', 'error', '-y', '-i', wav, '-ac', '1', '-ar', '44100',
                                    '-b:a', '64k', mp3], check=True)
                    ok += 1
                    break
                except urllib.error.HTTPError as e:
                    if attempt == 2:
                        fail += 1
                        print('FAIL', lang, row['id'], e.code, e.read().decode()[:120])
                    else:
                        time.sleep(2)
                except Exception as e:
                    if attempt == 2:
                        fail += 1
                        print('FAIL', lang, row['id'], str(e)[:120])
                    else:
                        time.sleep(2)
        print(f'{lang}: done')
    print(f'{ok} ok, {fail} failed · speaker {args.speaker}')


if __name__ == '__main__':
    main()

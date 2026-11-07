"use client";
import { useEffect, useRef, useState } from "react";
import { MAX_AUDIO_SECONDS } from "@/lib/media-reference";
import { uploadMedia, type MediaContext } from "@/lib/cloud/media";
import { authMessage } from "@/lib/cloud/client";
import { AudioPlayer } from "./media";
import { Icon } from "./icons";

type PendingAudio = { blob: Blob; url: string };
export function AudioInput({ value, context, onChange, onBusyChange, beforeUpload, disabled=false }: {
  value?: string;
  context: MediaContext;
  onChange: (source: string) => void;
  onBusyChange?: (busy: boolean) => void;
  beforeUpload?: () => Promise<void>;
  disabled?: boolean;
}) {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const [pendingUrl, setPendingUrl] = useState("");
  const alive = useRef(true), token = useRef(0), discard = useRef(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pending = useRef<PendingAudio | null>(null);
  const callbacks = useRef({ onChange, onBusyChange, beforeUpload });
  callbacks.current = { onChange, onBusyChange, beforeUpload };

  function occupied(next: boolean) {
    setBusy(next);
    callbacks.current.onBusyChange?.(next || !!pending.current);
  }
  function release() {
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }
  function clearPending() {
    if (pending.current) URL.revokeObjectURL(pending.current.url);
    pending.current = null;
    setPendingUrl("");
  }
  useEffect(() => {
    alive.current = true;
    const warn = (event: BeforeUnloadEvent) => {
      if (pending.current || recorder.current?.state === "recording") event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      alive.current = false;
      token.current++;
      discard.current = true;
      if (recorder.current?.state === "recording") recorder.current.stop();
      release();
      if (pending.current) URL.revokeObjectURL(pending.current.url);
      window.removeEventListener("beforeunload", warn);
      callbacks.current.onBusyChange?.(false);
    };
  }, []);

  async function upload(blob: Blob) {
    if (!pending.current || pending.current.blob !== blob) {
      clearPending();
      pending.current = { blob, url: URL.createObjectURL(blob) };
      setPendingUrl(pending.current.url);
    }
    const attempt = ++token.current;
    occupied(true);
    setError("");
    try {
      await callbacks.current.beforeUpload?.();
      const source = await uploadMedia(blob, context);
      if (alive.current && attempt === token.current) {
        callbacks.current.onChange(source);
        clearPending();
      }
    } catch (error) {
      if (alive.current && attempt === token.current) setError(authMessage(error));
    } finally {
      if (alive.current && attempt === token.current) occupied(false);
    }
  }
  function stop(cancel = false) {
    discard.current = cancel;
    if (recorder.current?.state === "recording") recorder.current.stop();
  }
  async function start() {
    if (disabled || busy || pending.current) return;
    occupied(true);
    setError("");
    discard.current = false;
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined")
        throw new Error("Nettleseren støtter ikke opptak her. Du kan velge en lydfil i stedet.");
      const input = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive.current) { input.getTracks().forEach(track => track.stop()); return; }
      stream.current = input;
      const mime = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"]
        .find(type => MediaRecorder.isTypeSupported(type));
      const record = new MediaRecorder(input, mime
        ? { mimeType: mime, audioBitsPerSecond: 64000 } : { audioBitsPerSecond: 64000 });
      recorder.current = record;
      const chunks: BlobPart[] = [];
      record.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      record.onerror = () => {
        discard.current = true;
        release();
        if (alive.current) {
          setRecording(false);
          occupied(false);
          setError("Opptaket ble avbrutt. Prøv igjen eller velg en lydfil.");
        }
      };
      record.onstop = () => {
        release();
        recorder.current = null;
        if (!alive.current) return;
        setRecording(false);
        if (discard.current) { occupied(false); return; }
        void upload(new Blob(chunks, { type: record.mimeType || "audio/mp4" }));
      };
      record.start(1000);
      setRecording(true);
      setSeconds(0);
      const started = Date.now();
      timer.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - started) / 1000);
        setSeconds(Math.min(elapsed, MAX_AUDIO_SECONDS));
        if (elapsed >= MAX_AUDIO_SECONDS && record.state === "recording") record.stop();
      }, 250);
    } catch (error) {
      release();
      if (alive.current) {
        occupied(false);
        setError(error instanceof DOMException && error.name === "NotAllowedError"
          ? "Mikrofonen er ikke tilgjengelig. Tillat mikrofon i nettleseren, eller velg en lydfil."
          : authMessage(error));
      }
    }
  }
  const pendingExtension = pending.current?.blob.type.includes("mp4") ? "m4a"
    : pending.current?.blob.type.includes("mpeg") ? "mp3"
    : pending.current?.blob.type.includes("wav") ? "wav"
    : pending.current?.blob.type.includes("ogg") ? "ogg" : "webm";
  return (
    <div className="audio-input">
      {pendingUrl ? <AudioPlayer src={pendingUrl} label="Lydhilsenen din · ikke lagret ennå" />
        : value && <AudioPlayer src={value} compact />}
      <div className="audio-input-actions">
        {recording ? <>
          <span className="recording-time" role="timer"><i />{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</span>
          <button type="button" className="button primary small-button" onClick={() => stop()}><Icon name="check" size={16} />Stopp opptak</button>
          <button type="button" className="button secondary small-button" onClick={() => stop(true)}>Avbryt opptak</button>
        </> : <>
          <button type="button" className="button secondary small-button" disabled={disabled || busy || !!pendingUrl} onClick={() => void start()}>
            <Icon name="mic" size={16} />{busy ? "Lagrer lyd …" : value ? "Spill inn på nytt" : "Spill inn hilsen"}
          </button>
          <label className="button secondary small-button"><Icon name="upload" size={16}/>Velg lydfil
            <input type="file" accept="audio/*,.m4a,.mp3,.wav,.ogg,.webm" disabled={disabled || busy || !!pendingUrl} onChange={event => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
              event.target.value = "";
            }} />
          </label>
        </>}
      </div>
      <p className="field-help">Opptak opptil 3 minutter. Lydfiler opptil 8 MB.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      {pendingUrl && !busy && <div className="audio-pending">
        <p className="field-help">Lydhilsenen beholdes her mens boksen er åpen. Prøv igjen, eller lagre lydfilen før du lukker.</p>
        <div className="audio-input-actions">
          <button type="button" className="button primary small-button" onClick={() => { if (pending.current) void upload(pending.current.blob); }}>Prøv igjen</button>
          <a className="button secondary small-button" href={pendingUrl} download={`luke-lydhilsen.${pendingExtension}`}>Lagre lydfil</a>
          <button type="button" className="button secondary small-button" onClick={() => { clearPending(); setError(""); occupied(false); }}>Forkast opptak</button>
        </div>
      </div>}
    </div>
  );
}

"use client";
import { useEffect, useRef, useState } from "react";
import SignaturePad from "signature_pad";
import { Eraser, PenLine, Check } from "lucide-react";
import { Modal, Message, Spinner } from "./ui/primitives";
import { Button } from "./ui/button";
function Canvas({ onReady }: { onReady: (pad: SignaturePad) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const ready = useRef(onReady);
  useEffect(() => {
    const canvas = ref.current!;
    const ratio = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext("2d")!.scale(ratio, ratio);
    const pad = new SignaturePad(canvas, {
      backgroundColor: "#ffffff",
      penColor: "#20242D",
      minWidth: 1,
      maxWidth: 2.5,
    });
    ready.current(pad);
    let previousWidth = canvas.offsetWidth,
      previousHeight = canvas.offsetHeight;
    const resize = new ResizeObserver(() => {
      const width = canvas.offsetWidth,
        height = canvas.offsetHeight;
      if (
        !width ||
        !height ||
        (width === previousWidth && height === previousHeight)
      )
        return;
      const data = pad
        .toData()
        .map((group) => ({
          ...group,
          points: group.points.map((point) => ({
            ...point,
            x: (point.x * width) / previousWidth,
            y: (point.y * height) / previousHeight,
          })),
        }));
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      canvas.getContext("2d")!.scale(ratio, ratio);
      pad.clear();
      pad.fromData(data);
      previousWidth = width;
      previousHeight = height;
    });
    resize.observe(canvas);
    return () => {
      resize.disconnect();
      pad.off();
    };
  }, []);
  return (
    <canvas
      ref={ref}
      className="signature-canvas"
      aria-label="Поле для рисования подписи пальцем или мышью"
    />
  );
}
export function SignatureDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (png: string) => Promise<void>;
}) {
  const pad = useRef<SignaturePad | null>(null);
  const [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (open) {
      setConsent(false);
      setError("");
    }
  }, [open]);
  async function submit() {
    if (!pad.current || pad.current.isEmpty()) {
      setError("Нарисуйте подпись в белом поле.");
      return;
    }
    if (!consent) {
      setError("Подтвердите согласие с условиями.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      await onConfirm(pad.current.toDataURL("image/png"));
      onOpenChange(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open={open}
      onOpenChange={(v) => {
        if (!busy) onOpenChange(v);
      }}
      title="Ваша подпись"
      description="Нарисуйте подпись мышью или пальцем. Она будет добавлена к этой версии документа."
    >
      <Canvas
        onReady={(p) => {
          pad.current = p;
        }}
      />
      <div className="signature-caption">
        <span>
          <PenLine size={12} style={{ display: "inline", marginRight: 5 }} />
          Подпишите внутри белого поля
        </span>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => pad.current?.clear()}
        >
          <Eraser size={13} />
          Очистить
        </Button>
      </div>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          disabled={busy}
        />
        <span>
          Я проверил(а) документ и свои данные, согласен(на) с условиями и
          обработкой указанных данных для заключения и хранения контракта.
          Понимаю, что графическая подпись не является квалифицированной ЭЦП.
        </span>
      </label>
      {error && (
        <div style={{ marginTop: 18 }}>
          <Message>{error}</Message>
        </div>
      )}
      <div className="form-actions">
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => onOpenChange(false)}
        >
          Назад к документу
        </Button>
        <Button disabled={busy || !consent} onClick={submit}>
          {busy ? <Spinner /> : <Check size={15} />}Подписать и подтвердить
        </Button>
      </div>
    </Modal>
  );
}

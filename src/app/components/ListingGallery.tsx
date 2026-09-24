"use client";

import { ChevronLeft, ChevronRight, Images, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import de from "@/dictionaries/de.json";
import en from "@/dictionaries/en.json";
import useLocale from "./useLocale";

const dictionaries = { de, en } as const;

type Status = "idle" | "loading" | "error" | "done";

const SWIPE_THRESHOLD = 40;

function dedupe(first: string | null, urls: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const u of [first, ...urls]) {
    if (!u || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

export default function ListingGallery({
  marketplace,
  id,
  title,
  coverUrl,
}: {
  marketplace: "ricardo" | "tutti";
  id: string;
  title: string;
  coverUrl: string | null;
}): React.ReactElement {
  const [locale] = useLocale();
  const dict = (dictionaries[locale] || dictionaries.de) as typeof en;
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [images, setImages] = useState<string[]>(coverUrl ? [coverUrl] : []);
  const [index, setIndex] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const touchStartX = useRef<number | null>(null);

  const fetchImages = async () => {
    setStatus("loading");
    try {
      const res = await fetch(
        `/api/listing-images?marketplace=${marketplace}&id=${encodeURIComponent(id)}`,
      );
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { images: string[] };
      setImages(dedupe(coverUrl, data.images ?? []));
      setStatus("done");
    } catch {
      setStatus("error");
    }
  };

  const handleClose = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  const goPrev = useCallback(
    () => setIndex((i) => (i - 1 + images.length) % images.length),
    [images.length],
  );
  const goNext = useCallback(() => setIndex((i) => (i + 1) % images.length), [images.length]);

  const handleOpen = () => {
    setOpen(true);
    setIndex(0);
    if (status === "idle") void fetchImages();
  };

  // Scroll lock, keyboard nav (Escape/arrows/Tab trap), focus close button.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      } else if (e.key === "ArrowLeft" && images.length > 1) {
        goPrev();
      } else if (e.key === "ArrowRight" && images.length > 1) {
        goNext();
      } else if (e.key === "Tab") {
        const root = dialogRef.current;
        if (!root) return;
        const focusables = Array.from(
          root.querySelectorAll<HTMLButtonElement>("button:not([disabled])"),
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, images.length, handleClose, goPrev, goNext]);

  if (coverUrl === null) {
    return (
      <div className="shrink-0">
        <div className="h-24 w-24 md:h-32 md:w-32 rounded-[2px] bg-canvas border border-border flex items-center justify-center text-xs text-text-secondary">
          {dict.no_image}
        </div>
      </div>
    );
  }

  const counter = dict.photo_counter
    .replace("{current}", String(index + 1))
    .replace("{total}", String(images.length));

  return (
    <div className="shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-label={`${dict.open_photos}: ${title}`}
        onClick={handleOpen}
        className="relative group rounded-[2px] overflow-hidden border border-border focus-visible:ring-2 focus-visible:ring-[--focus] focus-visible:outline-none cursor-pointer block"
      >
        <Image
          src={coverUrl}
          alt={title}
          width={128}
          height={128}
          className="h-24 w-24 md:h-32 md:w-32 object-cover bg-canvas"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
            const sib = e.currentTarget.nextElementSibling as HTMLElement | null;
            if (sib) sib.style.display = "flex";
          }}
        />
        <div
          className="h-24 w-24 md:h-32 md:w-32 rounded-[2px] bg-canvas border border-border items-center justify-center text-xs text-text-secondary"
          style={{ display: "none" }}
        >
          {dict.no_image}
        </div>
        <span className="absolute bottom-1 right-1 flex items-center gap-1 rounded-[2px] border border-border bg-panel/90 px-1 py-0.5 text-[10px] text-text-secondary group-hover:text-text-primary group-hover:border-interface-accent">
          <Images size={11} aria-hidden="true" />
          <span>{dict.photos}</span>
        </span>
      </button>

      {open &&
        createPortal(
          // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click is a mouse-only dismissal; keyboard users close via Escape/Close button.
          // biome-ignore lint/a11y/noStaticElementInteractions: backdrop div handles click-to-close; the dialog itself carries role="dialog".
          <div
            className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center"
            onClick={handleClose}
          >
            {/* biome-ignore lint/a11y/useKeyWithClickEvents: stopPropagation wrapper only; no keyboard semantics needed. */}
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-label={title}
              className="relative max-w-4xl w-full mx-2 sm:mx-4"
              onClick={(e) => e.stopPropagation()}
              onTouchStart={(e) => {
                touchStartX.current = e.touches[0].clientX;
              }}
              onTouchEnd={(e) => {
                if (touchStartX.current === null || images.length < 2) return;
                const delta = e.changedTouches[0].clientX - touchStartX.current;
                touchStartX.current = null;
                if (Math.abs(delta) <= SWIPE_THRESHOLD) return;
                if (delta > 0) goPrev();
                else goNext();
              }}
            >
              <div className="relative h-[70vh] max-h-[70vh] w-full touch-manipulation overscroll-contain">
                {status === "loading" ? (
                  <div className="h-full w-full flex flex-col items-center justify-center gap-2">
                    {coverUrl ? (
                      <Image
                        src={coverUrl}
                        alt={title}
                        fill
                        className="object-contain"
                        sizes="100vw"
                        referrerPolicy="no-referrer"
                      />
                    ) : null}
                    <p className="text-xs text-text-secondary">{dict.loading_photos}</p>
                  </div>
                ) : status === "error" ? (
                  <div className="h-full w-full flex flex-col items-center justify-center gap-2">
                    {coverUrl ? (
                      <Image
                        src={coverUrl}
                        alt={title}
                        fill
                        className="object-contain"
                        sizes="100vw"
                        referrerPolicy="no-referrer"
                      />
                    ) : null}
                    <p className="text-xs text-error-text">{dict.could_not_load_photos}</p>
                  </div>
                ) : images.length === 0 ? (
                  <div className="h-full w-full flex items-center justify-center">
                    <p className="text-xs text-text-secondary">{dict.no_photos_available}</p>
                  </div>
                ) : (
                  <Image
                    src={images[index]}
                    alt={`${title} ${index + 1}`}
                    fill
                    className="object-contain"
                    sizes="100vw"
                    priority
                    referrerPolicy="no-referrer"
                  />
                )}

                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      aria-label={dict.previous_photo}
                      onClick={goPrev}
                      className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-panel/80 p-1.5 text-text-primary border border-border hover:bg-panel focus-visible:ring-2 focus-visible:ring-[--focus] focus-visible:outline-none min-h-[40px] min-w-[40px] flex items-center justify-center"
                    >
                      <ChevronLeft aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={dict.next_photo}
                      onClick={goNext}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-panel/80 p-1.5 text-text-primary border border-border hover:bg-panel focus-visible:ring-2 focus-visible:ring-[--focus] focus-visible:outline-none min-h-[40px] min-w-[40px] flex items-center justify-center"
                    >
                      <ChevronRight aria-hidden="true" />
                    </button>
                  </>
                )}
                <button
                  ref={closeRef}
                  type="button"
                  aria-label={dict.close}
                  onClick={handleClose}
                  className="absolute top-2 right-2 rounded-full bg-panel/80 p-1.5 text-text-primary border border-border hover:bg-panel focus-visible:ring-2 focus-visible:ring-[--focus] focus-visible:outline-none min-h-[40px] min-w-[40px] flex items-center justify-center"
                >
                  <X aria-hidden="true" />
                </button>
              </div>
              {status === "done" && images.length > 0 && (
                <p className="mt-2 text-center tabular-nums text-xs text-text-secondary">
                  {counter}
                </p>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

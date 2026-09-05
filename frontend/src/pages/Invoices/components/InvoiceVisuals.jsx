export const defaultLogoImage = "/invoice-assets/comfort-cars-logo.png";
export const defaultSignatureImage =
  "/invoice-assets/digital-signature-stamp.jpeg";

function InvoiceImage({ src, fallbackSrc, alt, className }) {
  return (
    <img
      src={src || fallbackSrc}
      alt={alt}
      className={className}
      draggable="false"
    />
  );
}

export function InvoiceLogo({ src, className = "h-36 w-44 object-contain" }) {
  return (
    <InvoiceImage
      src={src}
      fallbackSrc={defaultLogoImage}
      alt="Company logo"
      className={className}
    />
  );
}

export function InvoiceSignature({
  src,
  className = "mx-auto h-24 w-64 object-contain",
}) {
  return (
    <InvoiceImage
      src={src}
      fallbackSrc={defaultSignatureImage}
      alt="Signature"
      className={className}
    />
  );
}

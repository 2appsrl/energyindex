import Link from "next/link";

export default function HomeIt() {
  return (
    <div className="container mx-auto py-16 px-4 space-y-4">
      <h1 className="text-4xl font-bold">Energy Index</h1>
      <p className="text-muted-foreground">
        Osservatorio prezzi luce e gas in tempo reale.
      </p>
      <p>
        <Link href="/it/indice/pun" className="underline text-primary">
          Vedi il PUN di oggi →
        </Link>
      </p>
    </div>
  );
}

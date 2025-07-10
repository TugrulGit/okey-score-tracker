import Head from 'next/head';
import { Button } from 'ui-kit';

export default function Home() {
  return (
    <>
      <Head>
        <title>Okey Score • Hello World</title>
      </Head>
      <main className="h-screen flex flex-col items-center justify-center text-center">
        <h1 className="text-4xl font-bold mb-4">Hello World 👋</h1>
        <Button onClick={() => alert('Button clicked!')}>Click me</Button>
      </main>
    </>
  );
}

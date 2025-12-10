import Head from 'next/head';
import { Button } from 'ui-kit';
import { useState } from 'react';
import Link from 'next/link';

export default function Home() {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert(`Hello, ${name}!`);
  };

  return (
    <>
      <Head>
        <title>Okey Score • Hello World</title>
      </Head>
      <main className="h-screen flex flex-col items-center justify-center text-center">
        <h1 className="text-4xl font-bold mb-4">Hello World 👋</h1>
        <Button onClick={() => alert('Button clicked!')}>Click me</Button>
        <Link href="/score_board">
          <Button>
            Go To Score Board
          </Button>
        </Link>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button type="submit">Submit</Button>
        </form>
      </main>
    </>
  );
}

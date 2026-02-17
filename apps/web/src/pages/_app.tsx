import type { AppProps } from 'next/app';
import { ThemeProvider } from '../lib/theme/ThemeProvider';
import '../styles/global.css';

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider>
      <Component {...pageProps} />
    </ThemeProvider>
  );
}

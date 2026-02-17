import Document, { DocumentContext, Head, Html, Main, NextScript } from 'next/document';

const THEME_STORAGE_KEY = 'okey-score-theme';

const themeInitializer = `(() => {
  const storageKey = '${THEME_STORAGE_KEY}';
  const prefersDarkQuery = '(prefers-color-scheme: dark)';
  const root = document.documentElement;
  try {
    const stored = window.localStorage.getItem(storageKey);
    const systemPrefersDark = window.matchMedia(prefersDarkQuery).matches;
    const theme = stored === 'light' || stored === 'dark' ? stored : (systemPrefersDark ? 'dark' : 'light');
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
  } catch (error) {
    console.warn('Unable to hydrate theme preference', error);
  }
})();`;

class MyDocument extends Document {
  static async getInitialProps(ctx: DocumentContext) {
    const initialProps = await Document.getInitialProps(ctx);
    return { ...initialProps };
  }

  render() {
    return (
      <Html lang="en" data-theme="light">
        <Head>
          <script dangerouslySetInnerHTML={{ __html: themeInitializer }} />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default MyDocument;

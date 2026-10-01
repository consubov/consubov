export const docsHtml = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Consubov Developers</title>
  <style>
    :root {
      color-scheme: light dark;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif;
    }
    body {
      margin: 0;
      background: #0b1015;
      color: #e8edf2;
    }
    main {
      width: min(960px, calc(100% - 32px));
      margin: 0 auto;
      padding: 48px 0 72px;
    }
    header {
      margin-bottom: 32px;
    }
    h1 {
      margin: 0 0 8px;
      font-size: clamp(2rem, 5vw, 3.5rem);
    }
    p {
      color: #aeb9c4;
      line-height: 1.6;
    }
    .endpoint {
      display: grid;
      grid-template-columns: 72px 1fr;
      gap: 16px;
      padding: 18px;
      margin: 12px 0;
      border: 1px solid #26313d;
      border-radius: 12px;
      background: #111820;
    }
    .method {
      font-weight: 700;
      color: #7dd3fc;
    }
    code {
      color: #f8fafc;
    }
    details {
      margin-top: 32px;
      border-top: 1px solid #26313d;
      padding-top: 20px;
    }
    pre {
      max-height: 520px;
      overflow: auto;
      padding: 16px;
      border-radius: 12px;
      background: #070a0d;
      font-size: 12px;
    }
    .error {
      color: #fca5a5;
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Consubov Developers</h1>
      <p>Documentação local gerada a partir do contrato OpenAPI atual.</p>
    </header>

    <section id="endpoints" aria-live="polite">
      <p>Carregando contrato OpenAPI…</p>
    </section>

    <details>
      <summary>Ver OpenAPI completo</summary>
      <pre id="raw-openapi"></pre>
    </details>
  </main>

  <script>
    const endpoints = document.getElementById("endpoints");
    const raw = document.getElementById("raw-openapi");

    fetch("/api/v1/openapi.json")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Falha ao carregar o contrato OpenAPI");
        }
        return response.json();
      })
      .then((spec) => {
        endpoints.textContent = "";

        for (const [path, methods] of Object.entries(spec.paths ?? {})) {
          for (const [method, operation] of Object.entries(methods ?? {})) {
            const article = document.createElement("article");
            article.className = "endpoint";

            const methodLabel = document.createElement("span");
            methodLabel.className = "method";
            methodLabel.textContent = method.toUpperCase();

            const content = document.createElement("div");
            const route = document.createElement("code");
            route.textContent = path;
            const summary = document.createElement("p");
            summary.textContent = operation.summary ?? "";

            content.append(route, summary);
            article.append(methodLabel, content);
            endpoints.append(article);
          }
        }

        raw.textContent = JSON.stringify(spec, null, 2);
      })
      .catch((error) => {
        endpoints.innerHTML = "";
        const message = document.createElement("p");
        message.className = "error";
        message.textContent = error instanceof Error ? error.message : "Erro inesperado";
        endpoints.append(message);
      });
  </script>
</body>
</html>`;

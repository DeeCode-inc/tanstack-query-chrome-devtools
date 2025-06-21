interface CodeBlockProps {
  code: string;
  language?: "javascript" | "typescript";
}

interface SyntaxToken {
  type:
    | "keyword"
    | "property"
    | "operator"
    | "variable"
    | "punctuation"
    | "text"
    | "type";
  value: string;
}

export function CodeBlock({ code, language = "javascript" }: CodeBlockProps) {
  const tokenizeJavaScript = (code: string): SyntaxToken[] => {
    const tokens: SyntaxToken[] = [];

    // Simple tokenizer for the specific code: window.__TANSTACK_QUERY_CLIENT__ = queryClient
    const parts = code.split(/(\.|=|\s+)/);

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];

      if (!part) continue;

      if (part === "window") {
        tokens.push({ type: "keyword", value: part });
      } else if (part === ".") {
        tokens.push({ type: "punctuation", value: part });
      } else if (part === "__TANSTACK_QUERY_CLIENT__") {
        tokens.push({ type: "property", value: part });
      } else if (part === "=") {
        tokens.push({ type: "operator", value: part });
      } else if (part === "queryClient") {
        tokens.push({ type: "variable", value: part });
      } else if (part.trim() === "") {
        tokens.push({ type: "text", value: part });
      } else {
        tokens.push({ type: "text", value: part });
      }
    }

    return tokens;
  };

  const tokenizeTypeScript = (code: string): SyntaxToken[] => {
    const tokens: SyntaxToken[] = [];

    // Split by lines first to preserve line breaks
    const lines = code.split("\n");

    lines.forEach((line, lineIndex) => {
      if (lineIndex > 0) {
        tokens.push({ type: "text", value: "\n" });
      }

      // Simple keyword-based highlighting for TypeScript
      const words = line.split(/(\s+|[{}();:"])/);

      words.forEach((word) => {
        if (!word) return;

        if (word === "interface" || word === "import") {
          tokens.push({ type: "keyword", value: word });
        } else if (word === "Window") {
          tokens.push({ type: "type", value: word });
        } else if (word === "__TANSTACK_QUERY_CLIENT__") {
          tokens.push({ type: "property", value: word });
        } else if (word.startsWith('"') && word.endsWith('"')) {
          tokens.push({ type: "text", value: word });
        } else if (["{", "}", ";", ":", "(", ")"].includes(word)) {
          tokens.push({ type: "punctuation", value: word });
        } else {
          tokens.push({ type: "text", value: word });
        }
      });
    });

    return tokens;
  };

  const getTokenClassName = (type: SyntaxToken["type"]): string => {
    switch (type) {
      case "keyword":
        return "text-blue-600 dark:text-blue-400"; // VSCode keyword blue
      case "property":
        return "text-blue-800 dark:text-blue-300"; // VSCode property dark blue
      case "operator":
        return "text-gray-600 dark:text-gray-400"; // VSCode operator gray
      case "variable":
        return "text-blue-800 dark:text-blue-300"; // VSCode variable dark blue
      case "punctuation":
        return "text-gray-600 dark:text-gray-400"; // VSCode punctuation gray
      case "type":
        return "text-green-600 dark:text-green-400"; // VSCode type green
      case "text":
      default:
        return "text-gray-800 dark:text-gray-200"; // Default text color
    }
  };

  const tokens =
    language === "javascript"
      ? tokenizeJavaScript(code)
      : language === "typescript"
        ? tokenizeTypeScript(code)
        : [{ type: "text" as const, value: code }];

  return (
    <code className="text-sm font-mono whitespace-pre-wrap">
      {tokens.map((token, index) => (
        <span key={index} className={getTokenClassName(token.type)}>
          {token.value}
        </span>
      ))}
    </code>
  );
}

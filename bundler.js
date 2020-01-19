const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");
const babel = require("@babel/core");
const traverse = require("@babel/traverse").default;

const moduleAnalyser = filename => {
  const content = fs.readFileSync(filename, "utf-8");
  const ast = parser.parse(content, { sourceType: "module" });
  const dependencies = {};
  traverse(ast, {
    ImportDeclaration({ node }) {
      const dirname = path.dirname(filename);
      const newFile = path.join(dirname, node.source.value);
      dependencies[node.source.value] = newFile;
    }
  });
  const { code } = babel.transformFromAst(ast, null, {
    presets: ["@babel/preset-env"]
  });
  return {
    code,
    filename,
    dependencies
  };
};

const makeDependenciesGraph = entry => {
  const entryModule = moduleAnalyser(entry);
  const graphArry = [entryModule];
  for (let i = 0; i < graphArry.length; i++) {
    const { dependencies } = graphArry[i];
    if (dependencies) {
      for (let j in dependencies) {
        graphArry.push(moduleAnalyser(dependencies[j]));
      }
    }
  }
  const graph = {};
  graphArry.forEach(({ filename, code, dependencies }) => {
    graph[filename] = { code, dependencies };
  });
  return graph;
};

const generateCode = entry => {
  const graph = JSON.stringify(makeDependenciesGraph(entry));
  return `
    (function(graph){
        function require(module){
            function localRequire(relativePath) {
                return require(graph[module].dependencies[relativePath])
            };
            var exports = {};
            (function(require,exports,code){
                eval(code);
            })(localRequire,exports,graph[module].code);
            return exports;
        };
        require('${entry}');
    })(${graph})
    `;
};

const generate = generateCode("./src/index.js");

// 复制到浏览器运行
console.log(generate);

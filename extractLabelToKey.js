const cheerio = require('cheerio');
const fs = require('fs');
const http = require('http');
const path = require('path');

// 忽略翻译的文本
const ignoreTexts = [
  '1',
  'CVX',
  'USDT',
  'SUSHI',
  'DOGE',
  'SOL',
  'SHIB',
  'FLOKI',
  'GALA',
  'BABYDOGE',
  'APE',
  'GMX',
  'APT',
  'BONK',
  'PEPE',
  'TURBO',
  'HOT',
  '5%',
  '1%',
  '0.01%',
  'BABY',
  '10%',
  '2%',
  'API3',
  'TIA',
  '20%',
  'MEME',
  'HMSTR',
  '15%',
  'FIU',
  '1.5L+',
  '12.5L+',
  '4.8',
  '4.9',
  '5%',
  '1%',
  '0.01%',
  'BABY',
  '10%',
  '2%',
  'API3',
  'TIA',
  '20%',
  'MEME',
  'HMSTR',
  '15%',
  '4.8',
  '4.9',
  '0.0',
  'BABY',
  '1',
  '%',
  '0%',
  '2.5L+',
  '.5L+',
  '0',
  '2',
];

function extractText(htmlContent) {
  const $ = cheerio.load(htmlContent);
  const lang = {};

  // 提取HTML中的meta标签中的name为description和keywords的content属性
  $('meta[name="description"], meta[name="keywords"]').each((index, element) => {
    const content = $(element).attr('content');
    if (content) {
      lang[content] = '';
    }
  });

  // 定义需要忽略的标签
  const ignoreTags = ['script', 'style', 'noscript', 'iframe', 'svg'];

  // 提取HTML中的文本
  $('body').find('*').contents().each((index, element) => {
    if (element.type === 'text' && !$(element).parents(ignoreTags.join(',')).length) {
      const text = $(element).text().trim();
      if (text) {
        // 检查是否包含忽略的文本
        let containsIgnoreText = false;
        ignoreTexts.forEach(ignoreText => {
          if (text === ignoreText) {
            containsIgnoreText = true;
          }
        });

        if (!containsIgnoreText) {
          lang[text] = '';
        } else {
        }
      }
    }
  });

  // 
  //再次判断是否包含忽略的文本
  for (let text in lang) {
    ignoreTexts.includes(text) && delete lang[text];
  }

  return lang;
}

// 覆盖文本, 将文本替换成翻译后的文本,生成新的HTML内容，生成新的HTML文件
function replaceText(htmlContent, keyText) {
  const $ = cheerio.load(htmlContent);

  // 定义需要忽略的标签
  const ignoreTags = ['script', 'style', 'noscript', 'iframe', 'svg'];

  // 替换HTML中的文本
  $('body').find('*').contents().each((index, element) => {
    if (element.type === 'text' && !$(element).parents(ignoreTags.join(',')).length) {
      let text = $(element).text().trim();
      if (text) {
        for (let key in keyText) {
          if (keyText[key]===text) {
            text = `{{ $t("${key}") }}`;
          }
        }

        $(element).replaceWith(text);
      }
    }
  });

  return $.html();
}

// 读取HTML文件内容
function translateFile(htmlFilePath, translatedDirPath) {
  fs.readFile(htmlFilePath, 'utf8', async (err, htmlContent) => {
    if (err) {
      console.error('Error reading the HTML file:', err);
      return;
    }

    // 提取文本
    const extractedText = extractText(htmlContent);
    // console.log('extractedText', extractedText);

    const obj = {}
    for (let text in extractedText) {
      // 将text中的空格替换为_,并在最前面加上v5Home_
      const newText = `v5Home_${text.replace(/\s+/g, '_')}`;
      obj[newText] = text;
    }
    console.log(obj);
    // 输入obj到json文件中
    const jsonFilePath = path.join(translatedDirPath, 'key' + '.json');
    fs.writeFileSync(jsonFilePath, JSON.stringify(obj, null, 2));

    // 替换HTML中的文本
    const newHtmlContent = replaceText(htmlContent, obj);
    // 将新的HTML内容写入到新的HTML文件中
    const newHtmlFilePath = path.join(translatedDirPath, 'new' + '.html');
    fs.writeFileSync(newHtmlFilePath, newHtmlContent);

    // 将翻译后的文本用对象的形式单独输出到一个文件中保存
    // const translatedTextFilePath = path.join(translatedDirPath, toLang, path.basename(htmlFilePath) + '.translated.json');
    // const translatedTextDirPath = path.dirname(translatedTextFilePath);
    // if (!fs.existsSync(translatedTextDirPath)) {
    //   fs.mkdirSync(translatedTextDirPath, { recursive: true });
    // }
    // fs.writeFile(translatedTextFilePath, JSON.stringify(extractedText, null, 2), (err) => {
    //   if (err) {
    //     console.error('Error writing the translated text file:', err);
    //     return;
    //   }

    //   console.log('Translated text file saved:', translatedTextFilePath);
    // }
    // );
  });
}

const originDirPath = './keyFile/html';
const translatedDirPath = './keyFile/json';

// 扫描originFile目录下的所有HTML文件,获取文件路径，包括子目录下的HTML文件，对每个HTML文件执行上述操作
fs.readdir(originDirPath, (err, files) => {
  // 输出一个loading 图标
  console.log('Loading...');
  if (err) {
    console.error('Error reading the origin directory:', err);
    return;
  }

  files.forEach((file) => {
    const filePath = path.join(originDirPath, file);
    fs.stat(filePath, (err, stats) => {
      if (err) {
        console.error('Error reading the file stats:', err);
        return;
      }

      if (stats.isFile() && path.extname(filePath) === '.html') {
        translateFile(filePath, translatedDirPath);
      }
    });
  });
});

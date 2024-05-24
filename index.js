const cheerio = require('cheerio');
const fs = require('fs');
const http = require('http');
const path = require('path');

function extractText(htmlContent) {
  const $ = cheerio.load(htmlContent);
  const lang = {};

  // 提去HTML中的meta标签中的name为description和keywords的content属性
  $('meta').each((index, element) => {
    const name = $(element).attr('name');
    if (name === 'description') {
      const content = $(element).attr('content');
      if (content) {
        lang[content] = '';
      }
    }
  })

  // 提取HTML中的文本
  $('*').contents().filter((index, element) => {
    return element.type === 'text';
  }).each((index, element) => {
    const text = element.data.trim();
    if (text) {
      lang[text] = '';
    }
  });

  return lang;
}

function translateText(text, fromLang, toLang) {
  // 将text翻译成toLang语言

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'translate.google.com',
      path: `/translate_a/single?client=gtx&sl=${fromLang}&tl=${toLang}&dt=t&q=${encodeURIComponent(text)}`,
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const result = JSON.parse(data);
        const translatedText = result[0][0][0];
        resolve(translatedText);
      });
    });

    req.on('error', (e) => {
      console.error(`Got error: ${e.message}`);
      reject(e);
    });

    req.end();
  })
}

// 覆盖文本, 将文本替换成翻译后的文本,生成新的HTML内容，生成新的HTML文件
function replaceText(htmlContent, translateText, toLang) {
  const $ = cheerio.load(htmlContent);

  // 替换meta标签中的name为description的content属性
  $('meta').each((index, element) => {
    const name = $(element).attr('name');
    if (name === 'description') {
      const content = $(element).attr('content');
      if (content && translateText[content]) {
        $(element).attr('content', translateText[content]);
      }
    }
  });


  $('*').contents().filter((index, element) => {
    return element.type === 'text';
  }).each((index, element) => {
    const text = element.data.trim();
    if (text && translateText[text]) {
      $(element).replaceWith(translateText[text]);
    }
  });

  // 修改html标签中的lang属性
  $('html').attr('lang', toLang);

  return $.html();
}

// 读取HTML文件内容
function translateFile(htmlFilePath, translatedDirPath, toLang) {
  fs.readFile(htmlFilePath, 'utf8', async (err, htmlContent) => {
    if (err) {
      console.error('Error reading the HTML file:', err);
      return;
    }

    // 提取文本
    const extractedText = extractText(htmlContent);

    // 翻译文本
    for (let text in extractedText) {
      try {
        const translatedText = await translateText(text, 'en', toLang);
        extractedText[text] = translatedText;
      } catch (e) {
        console.error('Error translating text:', text, e);
      }
    }

    // 替换文本
    const newHtmlContent = replaceText(htmlContent, extractedText, toLang);

    // 生成新的HTML文件, 保存到新的文件中,保留原文件，新文件放在translatedFile目录下，文件名跟原文件名一样
    // 判断translatedFile目录下是否存在toLang目录，如果不存在则创建，将新的HTML文件保存到toLang目录下
    const newHtmlFilePath = path.join(translatedDirPath, toLang, path.basename(htmlFilePath));
    const newHtmlDirPath = path.dirname(newHtmlFilePath);
    if (!fs.existsSync(newHtmlDirPath)) {
      fs.mkdirSync(newHtmlDirPath, { recursive: true });
    }
    fs.writeFile(newHtmlFilePath, newHtmlContent, (err) => {
      if (err) {
        console.error('Error writing the new HTML file:', err);
        return;
      }

      console.log('New HTML file saved:', newHtmlFilePath);
    });
  });
}

toLangs = [
  "zh-TW",
  "fr", 
  "it",
  "ja",
  "ko",
  "de",
  "ru",
  "vi",
  "pt",
  "tr",
  "es",
  "fa",
  "ar",
  "id",
  "el",
  "ms",
  "th",
  "la",
  "hi",
  "bn",
  "ur"
]
const originDirPath = './originFile';
const translatedDirPath = './translatedFile'

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
        toLangs.forEach((toLang) => {
          translateFile(filePath, translatedDirPath, toLang);
        });
      }
    });
  });
});


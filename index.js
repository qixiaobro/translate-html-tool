const cheerio = require('cheerio');
const fs = require('fs');
const http = require('http');
const path = require('path');

// 忽略翻译的文本
const ignoreTexts = [
  'Superai',
  'SuperAI',
  'superai',
  'superaigtp@gmail.com',
  'USDT',
  'Copyright © 2021-2024 Super AI,Inc. All rights reserved.',
  ' USDT',
  'play_arrow',
  'English',
  'Français',
  'Italiano',
  '日本語',
  '한국어',
  'Deutsch',
  'Русский',
  'Tiếng Việt',
  'Português',
  'Türkçe',
  'Español',
  'فارسی',
  'العربية',
  'Bahasa Indonesia',
  'Ελληνικά',
  'Melayu',
  'แบบไทย',
  'Latinus',
  'हिंदी',
  'বাংলা',
  'اردو',
  '繁体中文'
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
          if (text.includes(ignoreText)) {
            containsIgnoreText = true;
          }
        });

        if (containsIgnoreText) {
          // 拆分并分别处理
          let remainingText = text;
          ignoreTexts.forEach(ignoreText => {
            if (remainingText.includes(ignoreText)) {
              const parts = remainingText.split(ignoreText);
              parts.forEach(part => {
                if (part.trim()) {
                  lang[part.trim()] = '';
                }
              });
              remainingText = remainingText.replace(new RegExp(ignoreText, 'g'), '');
            }
          });
        } else {
          lang[text] = '';
        }
      }
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
        // console.log('result:',text, result);
        // const translatedText = result[0][0][0];
        const translatedTexts = result[0].map(item => item[0]).join('');
        resolve(translatedTexts);
      });
    });

    req.on('error', (e) => {
      console.error(`Got error: ${e.message}`);
      reject(e);
    });

    req.end();
  });
}

// 覆盖文本, 将文本替换成翻译后的文本,生成新的HTML内容，生成新的HTML文件
function replaceText(htmlContent, translateText, toLang) {
  const $ = cheerio.load(htmlContent);

  // 替换meta标签中的name为description和keywords的content属性
  $('meta[name="description"], meta[name="keywords"]').each((index, element) => {
    const content = $(element).attr('content');
    if (content && translateText[content]) {
      $(element).attr('content', translateText[content]);
    }
  });

  // 定义需要忽略的标签
  const ignoreTags = ['script', 'style', 'noscript', 'iframe', 'svg'];

  // 替换HTML中的文本
  $('body').find('*').contents().each((index, element) => {
    if (element.type === 'text' && !$(element).parents(ignoreTags.join(',')).length) {
      let text = $(element).text().trim();
      if (text) {
        // 检查是否包含忽略的文本
        let containsIgnoreText = false;
        ignoreTexts.forEach(ignoreText => {
          if (text.includes(ignoreText)) {
            containsIgnoreText = true;
          }
        });

        if (containsIgnoreText) {
          // 拆分并分别处理
          ignoreTexts.forEach(ignoreText => {
            if (text.includes(ignoreText)) {
              const parts = text.split(ignoreText);
              const translatedParts = parts.map(part => translateText[part.trim()] || part.trim());
              text = translatedParts.join(ignoreText);
            }
          });
        } else if (translateText[text]) {
          text = translateText[text];
        }

        $(element).replaceWith(text);
      }
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
        const newText = text.replace(/[\r\n\t]/g, '');
        const translatedText = await translateText(newText, 'en', toLang);
        // console.log('Translated text:', text, '=>', translatedText);
        extractedText[text] = translatedText.replace(/^['"]+|['"]+$/g, '');
      } catch (e) {
        console.error('Error translating text:', text, e);
      }
    }

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
    // 生成新的HTML文件, 保存到新的文件中,保留原文件，新文件放在translatedFile目录下，文件名跟翻译的语言key一样
    // const newHtmlFilePath = path.join(translatedDirPath, toLang + '.html');
    // fs.writeFile(newHtmlFilePath, newHtmlContent, (err) => {
    //   if (err) {
    //     console.error('Error writing the new HTML file:', err);
    //     return;
    //   }

    //   console.log('New HTML file saved:', newHtmlFilePath);
    // });
  });
}

const toLangs = [
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
];
const originDirPath = './originFile';
const translatedDirPath = './translatedFile';

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

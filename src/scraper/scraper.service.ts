import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Page } from 'puppeteer';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const puppeteer = require('puppeteer');

@Injectable()
export class ScraperService {
  page: Page;
  url: string;

  constructor(private readonly config: ConfigService) {
    this.start().then();
  }

  async start() {
    const browser = await puppeteer.launch({ headless: false });
    this.page = await browser.newPage();
    this.url = this.config.get('url');
    await this.loginUser();
  }

  async loginUser() {
    await this.page.goto(this.url);
    await this.page.focus('input[id="session_key"]');
    await this.page.keyboard.type(this.config.get('email'));
    await this.page.focus('input[id="session_password"]');
    await this.page.keyboard.type(this.config.get('password'));
    await Promise.all([
      await this.page.keyboard.press('Enter'),
      await this.page.waitForNavigation({ waitUntil: 'networkidle2' }),
    ]);
    console.log('Linkedin Welcome!');
  }

  async findUsers(userName) {
    await this.page.keyboard.press('Enter');
    await this.inputFind(userName);
    await new Promise((r) => setTimeout(r, 2000));
    const isList = await this.page.$('main[id="main"] ul');
    if (!isList) {
      throw new HttpException(
        { status: HttpStatus.NOT_FOUND, error: 'Not Found' },
        HttpStatus.NOT_FOUND,
      );
    }
    return await this.page.$$eval('main[id="main"] ul li', (list) => {
      const resList = [];
      const length = list.length < 5 ? list.length : 5;
      for (let i = 0; i < length; i++) {
        const elem = list[i];
        const nameEl = elem.querySelector(
          'div[class*="linked-area"] span>div a>span>span',
        );
        if (nameEl) {
          const profileUrl = elem.querySelector('a').getAttribute('href');
          const img = elem.querySelector('a img');
          const avatarUrl = !!img ? img.getAttribute('src') : null;

          const name = nameEl
            ? nameEl.getAttribute('innerText') || nameEl.textContent
            : '';
          resList.push({
            profileUrl,
            avatarUrl,
            name,
          });
        }
      }
      return resList;
    });
  }

  async inputFind(query: string) {
    await this.page.click('div[class*="application-outlet"] button[id]');
    await this.page.waitForSelector('input[aria-label="Search"]');
    const input = await this.page.$('input[aria-label="Search"]');
    const count = await this.page.evaluate(() => {
      const el = document.querySelector('input[aria-label="Search"]');
      return el['value'].length;
    });
    if (count) {
      await input.click({ clickCount: count });
      await input.press('Backspace');
    }
    await input.type(query);
    await this.page.keyboard.press('Enter');
  }
}

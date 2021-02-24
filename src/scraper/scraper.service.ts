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
    const listUser = [];
    try {
      await this.page.keyboard.press('Enter');
      const sel =
        'div[id="global-nav-search"] div[role="listbox"]>div[id^="ember"]>div[id^="ember"]';
      await this.inputFind(userName);
      await this.page.waitForSelector(sel);
      const listIndexEl = await this.page.$$eval(sel, (list) => {
        const listIndexEl = [];
        list.forEach((el, index) => {
          if (el.querySelector('img')) {
            listIndexEl.push(index);
          }
        });
        return listIndexEl;
      });

      if (!listIndexEl.length) {
        return new HttpException(
          { status: HttpStatus.NOT_FOUND, error: 'Not found' },
          HttpStatus.NOT_FOUND,
        );
      }
      await this.clearInputFind(userName.length);
      for (let i = 0; i < listIndexEl.length; i++) {
        await this.inputFind(userName);
        await this.page.waitForSelector(sel);
        const listEl = await this.page.$$(sel);
        const index = listIndexEl[i];
        await Promise.all([
          await listEl[index].click(),
          await this.page.waitForNavigation({ waitUntil: 'networkidle2' }),
        ]);
        const userInfo = await this.getInfoUser();
        if (userInfo) {
          listUser.push(userInfo);
        }
        if (listUser.length === 5) break;
      }
      return listUser;
    } catch (e) {
      throw new HttpException(
        { status: HttpStatus.NOT_FOUND, error: 'Not Found' },
        HttpStatus.NOT_FOUND,
      );
    }
  }

  async inputFind(query: string) {
    await this.page.click('div[class*="application-outlet"] button[id]');
    await this.page.waitForSelector('input[aria-label="Search"]');
    await this.page.focus('input[aria-label="Search"]');
    await this.page.keyboard.type(query);
  }

  async clearInputFind(count) {
    const input = await this.page.$('input[aria-label="Search"]');
    await input.click({ clickCount: count });
    await input.press('Backspace');
    await Promise.all([
      await this.page.keyboard.press('Enter'),
      await this.page.waitForNavigation({ waitUntil: 'networkidle2' }),
    ]);
  }

  async getInfoUser() {
    const url = await this.page.url();
    const elementCompany = await this.page.$(
      'div[class*="organization-outlet"]',
    );
    const elementPerson = await this.page.$('main[id*="main"]');
    const elementGroup = await this.page.$('div[id*="groups"]');
    if (elementCompany || elementPerson || elementGroup) {
      const info = await this.page.evaluate(() => {
        const img =
          document.querySelector(
            'div[class*="organization-outlet"] div[id^="ember"] div[class="relative"] img[id^="ember"]',
          ) ||
          document.querySelector(
            'main[id="main"] div[id^="ember"]>img[title]',
          ) ||
          document.querySelector(
            'main[id="main"] div[id^="ember"]>button>img[id]',
          ) ||
          document.querySelector('div[id*="groups"] img[title]');
        const avatarUrl = !!img ? img.getAttribute('src') : '';
        const nameEl =
          document.querySelector(
            'div[class*="organization-outlet"] div[id^="ember"] div[class="relative"] h1',
          ) ||
          document.querySelector(
            'main[id="main"] section[id^="ember"] ul:first-child li:not([id])',
          ) ||
          document.querySelector('div[id*="groups"] h1');
        let name = !!nameEl ? nameEl.textContent.replace('\n', '') : '';
        name = name.trim();
        return { avatarUrl: avatarUrl, name: name };
      });
      return info.name || info.avatarUrl ? { profileUrl: url, ...info } : null;
    }
    return;
  }
}

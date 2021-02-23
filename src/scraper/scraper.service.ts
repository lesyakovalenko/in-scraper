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
    const browser = await puppeteer.launch({ headless: true });
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
    const reslist = [];
    let amountFindUser = 0;
    let count = 0;
    try {
      await this.page.keyboard.press('Enter');
      do {
        await this.page.click('div[class*="application-outlet"] button[id]');
        await this.page.waitForSelector('input[aria-label="Search"]');
        await this.page.focus('input[aria-label="Search"]');
        await this.page.keyboard.type('');
        await this.page.keyboard.type(userName);
        await new Promise((r) => setTimeout(r, 2000));
        const sel =
          'div[id="global-nav-search"] div[role="listbox"]>div[id^="ember"]>div[id^="ember"]';
        const index = reslist.length;
        const listEl = await this.page.$$(sel);
        amountFindUser = listEl.length - 1;
        if (!amountFindUser) {
          return new HttpException(
            { status: HttpStatus.NOT_FOUND, error: 'Not found' },
            HttpStatus.NOT_FOUND,
          );
        }

        await listEl[index].click();
        await new Promise((r) => setTimeout(r, 2000));
        const userInfo = await this.getInfoUser();

        if (userInfo) {
          reslist.push(userInfo);
        }
        ++count;
      } while (reslist.length < 5 && count < amountFindUser);
      return reslist;
    } catch (e) {
      throw new HttpException(
        { status: HttpStatus.NOT_FOUND, error: 'Not Found' },
        HttpStatus.NOT_FOUND,
      );
    }
  }

  async getInfoUser() {
    const url = await this.page.url();
    const elementCompany = this.page.$('div[class*="organization-outlet"]');
    const elementPerson = this.page.$('main[id="main"]');
    if (elementCompany || elementPerson) {
      const info = await this.page.evaluate(() => {
        const img =
          document.querySelector(
            'main[id="main"] div[id^="ember"]>img[title]',
          ) ||
          document.querySelector(
            'div[class*="organization-outlet"] div[id^="ember"] div[class="relative"] img[id^="ember"]',
          );
        const avatarUrl = !!img ? img.getAttribute('src') : '';
        const nameEl =
          document.querySelector(
            'main[id="main"] section[id^="ember"] ul:first-child li:not([id])',
          ) ||
          document.querySelector(
            'div[class*="organization-outlet"] div[id^="ember"] div[class="relative"] h1',
          );
        let name = !!nameEl ? nameEl.textContent.replace('\n', '') : '';
        name = name.trim();
        return { avatarUrl: avatarUrl, name: name };
      });
      return info.name && info.avatarUrl ? { profileUrl: url, ...info } : null;
    }
    return;
  }
}

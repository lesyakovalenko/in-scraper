import { Controller, Get, Query } from '@nestjs/common';
import { ScraperService } from './scraper.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('LinkedIn')
@Controller('linkedIn')
export class ScraperController {
  constructor(private scraperService: ScraperService) {}

  @Get('/findUsers')
  getFindListFriends(@Query('userName') userName: string) {
    return this.scraperService.findUsers(userName);
  }
}

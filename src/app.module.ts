import { Module } from '@nestjs/common';
import { ScraperModule } from './scraper/scraper.module';
import { ConfigModule } from '@nestjs/config';
import config from './config';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [config],
    }),
    ScraperModule,
  ],
})
export class AppModule {}

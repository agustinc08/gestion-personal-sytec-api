import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SearchService } from './search.service';
@UseGuards(JwtAuthGuard)
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}
  @Get() search(@Query('q') q: string, @CurrentUser() user: JwtUser) { return this.searchService.search(q || '', user); }
}

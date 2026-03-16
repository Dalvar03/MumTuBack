import { CurrentUser } from '../common/types/current-user.type';

declare global {
  namespace Express {
    interface Request {
      user?: CurrentUser;
    }
  }
}

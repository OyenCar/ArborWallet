import { BaseRepository } from "../base-repository";
import type { ContactDoc } from "../entities";

export class ContactsRepository extends BaseRepository<ContactDoc> {
  protected collectionName = "contacts";

  async findAllForUser(userId: string): Promise<ContactDoc[]> {
    return this.find({ userId });
  }
}

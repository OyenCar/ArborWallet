import { BaseRepository } from "../base-repository";
import type { UserDoc } from "../entities";

export class UsersRepository extends BaseRepository<UserDoc> {
  protected collectionName = "users";
  protected majorityWriteConcern = true;

  async findByFirebaseUid(uid: string): Promise<UserDoc | null> {
    return this.findOne({ firebaseUid: uid });
  }

  async findByUsername(username: string): Promise<UserDoc | null> {
    return this.findOne({ username });
  }
}

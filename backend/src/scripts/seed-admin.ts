import 'dotenv/config';
import dataSource from '../shared/config/typeorm.datasource.js';
import { User } from '../modules/users/user.entity.js';
import { UserProfile } from '../modules/users/user-profile.entity.js';

async function run() {
  const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase();
  const adminFullName = process.env.ADMIN_FULL_NAME || 'Admin';

  try {
    await dataSource.initialize();
    const usersRepo = dataSource.getRepository(User);
    const profilesRepo = dataSource.getRepository(UserProfile);

    if (!adminEmail) {
      const adminProfiles = await profilesRepo.find({ where: { role: 'admin' }, relations: ['user'] });
      for (const profile of adminProfiles) {
        if (profile.user) {
          await usersRepo.update({ id: profile.user.id }, { passwordHash: null });
        }
      }
      console.log(`Cleared password_hash for ${adminProfiles.length} admin account(s).`);
      await dataSource.destroy();
      process.exit(0);
    }

    let user = await usersRepo.findOne({ where: { email: adminEmail }, relations: ['profile'] });
    if (!user) {
      user = usersRepo.create({
        email: adminEmail,
        passwordHash: null,
        status: 'active',
      });
      await usersRepo.save(user);

      const profile = profilesRepo.create({
        user,
        fullName: adminFullName,
        role: 'admin',
      });
      await profilesRepo.save(profile);

      console.log(`Admin created: ${adminEmail}`);
    } else {
      await usersRepo.update({ id: user.id }, { passwordHash: null, status: 'active' });

      if (user.profile) {
        await profilesRepo.update({ id: user.profile.id }, { role: 'admin', fullName: adminFullName });
      } else {
        const profile = profilesRepo.create({
          user,
          fullName: adminFullName,
          role: 'admin',
        });
        await profilesRepo.save(profile);
      }

      console.log(`Admin updated: ${adminEmail}`);
    }

    await dataSource.destroy();
    process.exit(0);
  } catch (err) {
    console.error('Seed admin failed', err);
    try {
      await dataSource.destroy();
    } catch (_) {}
    process.exit(1);
  }
}

run();

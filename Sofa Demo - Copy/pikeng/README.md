### What is this repository for? ###

Web real time 3d display engine. 

### How do I get set up? ###

All Dependencies are included in the repository.

### Who do I talk to? ###

* george@pikcells.com

# Implementing as a submodule #

To implement pikeng as part of another module you can either clone the repository or add it as a submodule. We recommend useing submodule.

    git submodule add -b master git@github.com:Pikcells/pikeng-2.git /choose/location/

when using submodules in your repo:

    git submodule update --init 

--remote will force the submodule to use the latest commit from the branch. This will probably detach the head in the submodule repo.


#Updating a referenced Submodule

When in the master repo, and you want to update to the latest commit run

    git submodule update --init --remote

```--remote``` will force the submodule to use the latest commit from the branch. This will probably detach the head in the submodule repo.

The best way to update is to enter the submodule folder and pull from the submodules origin. 

# Syncing submodules with a master git pull.


modified:   public/js/pikeng-2.0 (new commits)

If you see this message after a master git pull then you just need to run:

    git submodule update

This will update the latest committed submodule.


#After Cloning a repo using submodules

You will have to initialise the submodules before git will do anything. During the Master repo pull it'll import the .submodules file with all the config but it will not initialise anything.

Make sure to run 

    git submodule update --init

That should pull all the submodule files into the mater repo for local development.

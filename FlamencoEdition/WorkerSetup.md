
# Documentation on setting up a Worker node
Assuming on ubuntu...

update the system
```
sudo apt update; sudo apt upgrade -y
```

install packages
```
sudo apt install openssh-server sshfs
sudo snap install --classic blender
```

Download stuff
```
cd Downloads
wget https://flamenco.blender.org/downloads/flamenco-3.9.1-linux-amd64.tar.gz
wget https://raw.githubusercontent.com/77Z/TheBlenderOrchestra/refs/heads/master/FlamencoEdition/BlenderNetworkMount.service
wget https://raw.githubusercontent.com/77Z/TheBlenderOrchestra/refs/heads/master/FlamencoEdition/FlamencoWorker.service
sudo mv BlenderNetworkMount.service /etc/systemd/system
sudo mv FlamencoWorker.service /etc/systemd/system
tar -xvf flamenco-3.9.1-linux-amd64.tar.gz
sudo mv flamenco-3.9.1-linux-amd64 /opt/flamenco
```

make the shared working directory for flamenco
```
sudo mkdir /mnt/BlenderSharedWork
sudo chown 1000:1000 /mnt/BlenderSharedWork
```

Set the network settings in ubuntu settings:
- Network
- Wired network options
- ipv4
- set to manual
- address can be anything as long as it doesn't collide with other computers on the network
- netmask should be 255.255.255.0

You'll have to connect to the manager at least once over ssh to verify certificates
```
ssh paradis1@192.168.1.10
```

Then you can start and enable them
(if the worker is also the manager then you don't need to enable the network mount)
```
sudo systemctl enable --now BlenderNetworkMount
sudo systemctl enable --now FlamencoWorker
sudo systemctl enable --now ssh
```